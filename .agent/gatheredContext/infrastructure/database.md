# Database Patterns & Convex

**Last Updated**: 2026-08-26

## Boost feed ordering (Phase 1B, Jul 2026) — READ FIRST if touching the feed

- **`ads.bumpedAt` is THE feed sort key, and it is REQUIRED (`v.number()`).** The feed
  (home + category feed: `convex/feed.ts` `getFeed` — see Unified home feed section below;
  search: `convex/ads.ts` `getAds` (search-only since the /simplify pass); fresh-rail:
  `getLatestAds`) orders by `bumpedAt`
  desc via the `by_bumped_at` and `by_category_and_bumped_at` indexes — NOT
  `_creationTime`. `_creationTime` is now display-only ("Posted X ago"). A boost
  (`convex/posts.ts` `boostAd`) re-stamps `bumpedAt = Date.now()`, lifting the ad to top.
  - `getFeed` arg is `maxSortTime` — a `bumpedAt` upper bound (freeze-at-mount).
    Its category branch applies the `bumpedAt` bound in the **post-filter** (the
    composite index leads with `categoryId`, so it can't range on `bumpedAt` in the index).
  - **Every `insert("ads")` MUST set `bumpedAt`** (schema validation now fails loudly
    otherwise) — this includes test helpers doing direct `ctx.db.insert("ads", …)`.
  - Two-deploy rollout: PROD must deploy Phase 1A (optional field + backfill) and run
    `migrations:backfillBumpedAt` to zero-undefined BEFORE the Phase 1B required-field +
    query-switch deploy, or old rows fail validation / sink to the feed bottom.
  - **POSTMORTEM (Jul 11 2026) — this rule was violated and caused a prod deploy outage.**
    PR #288 merged Phase 1A + 1B in ONE deploy, so the backfill never ran and
    `convex deploy` was rejected by legacy rows missing `bumpedAt`. That's a DEADLOCK:
    the failing deploy is also the one that would ship the backfill, so you can't run it.
    Recovery that worked: flip `defineSchema(tables, { schemaValidation: false })` (one
    boolean, NO type churn — schema stays `v.number()`, all reads stay typed `number`;
    making the field optional instead breaks ~6 typed read sites and the `tsc -b` gate),
    deploy, run the backfill to `done:true`, then a SEPARATE plain-edit PR removes the flag.
    Gotcha: the re-enable PR must be a **fresh edit off main**, NOT `git revert` of the
    disable commit — a branch containing both the flag-add and its revert **squash-merges
    to a net-zero diff** and silently does nothing (this is exactly how #292 "merged" yet
    left `schemaValidation: false` live on `main`; #293 fixed it with a plain edit).
  - When "prod migration function not found" in the Convex dashboard: you're likely on the
    wrong deployment. **Prod = `resilient-pheasant-112`; dev = `doting-dogfish-130`.** Also
    verify the Vercel prod build actually ran `convex deploy` — grep its log for
    `✅ Running Production Build: Deploying Convex backend.` (from `vercel-build.sh`, which
    only runs when `VERCEL_ENV==production`). No such line ⇒ the build was frontend-only.
- **`appSettings` table** = admin-tunable NUMERIC config (mirrors `featureFlags`, which
  is booleans-only). `{ key, value, description }` + `by_key`. `convex/appSettings.ts`:
  public `getSetting(key)` (clamped on read for ALL known keys, returns `number|null`),
  admin-gated `getAllSettings`/`updateSetting` (rejects out-of-range, `logAdminAction`;
  **upserts** known keys — a missing row is created with the registry description; unknown
  keys still throw "not found"). The setting REGISTRY (key/default/min/max/description/seed)
  lives in `convex/lib/appConfig.ts` (frontend-safe — NO server imports); boost bounds stay
  sourced from `convex/lib/boost.ts`. Seed via `migrations:seedAppSettings` (registry-driven,
  `seed: true` entries only). Client reads via `src/hooks/useAppSetting.ts`.
  Seeded keys (Jul 2026): `boostCooldownDays` (7, 1–30), `boostDailyCap` (3, 1–20),
  `bundleMaxItems` (4, 2–10 — `createBundle` + BundleFlow picker), `saleMaxItems`
  (100, 10–500 — `addSaleItems` abuse ceiling), `saleExpiryBufferDays` (2, 0–14 —
  `publishSaleEvent`), `feedSaleMemberCap` (3, 0–10) and `feedBundleMemberCap` (2, 0–10 —
  HomePage `underCap`). Server consumers read via `readSettingValue` + `clampAppSetting`
  with the registry default as fallback; the client mirrors with `useAppSetting(key) ?? DEFAULT_*`.
- **Sparse rate-limit overrides** (`rateLimitMax_<op>`, Jul 2026): `checkRateLimit` first
  looks up an appSettings override for the op's `maxRequests` (window is NEVER overridable),
  clamped to `[1, 4× static default]`. These rows are deliberately **NOT seeded** — missing
  row = static default; the admin Settings tab shows "Using default N" and creates the row
  on first save (via updateSetting's upsert). Static limits DATA + overridable-op list +
  `rateLimitSettingKey(op)` live in `convex/lib/rateLimitConfig.ts` (frontend-safe;
  `convex/lib/rateLimit.ts` imports it because it can't be imported by the UI itself).
  `boostAd` and `default` are EXCLUDED from overrides (boostAd is the static abuse backstop
  behind the already-configurable boost daily cap).
- **Runtime-configurable rate limit**: `checkRateLimitDynamic(ctx, userId, op, max, windowMs)`
  in `convex/lib/rateLimit.ts` takes max/window at call time (reuses the same
  `ratelimit:${userId}:${op}` uploads-table storage). `boostAd` uses it with the
  admin-configured cap (clamped ≤ 20 = the static `RATE_LIMITS.boostAd` backstop ceiling),
  so ONE rate-limit row per boost enforces both. Convex transactional rollback means only
  SUCCESSFUL boosts consume budget. Don't ALSO call `checkRateLimit` for the same op —
  that double-inserts. Feature flag `boostToTop` gates `boostAd` server-side (fail closed).

## Unified home feed — `mergedStream` (Jul 2026) — first use in the project

The home feed is ONE paginated query, `convex/feed.ts` `getFeed`, interleaving three
tables (ads, standalone `saleBundles`, published `saleEvents`) on the shared `bumpedAt`
sort key via convex-helpers `mergedStream`. This replaced the client-side three-query
merge (`getActiveBundleFeedCards` / `getActiveSales` were deleted; `ads.getAds` is now
**search-only** — `getFeed`'s category branch owns category feeds, and `getFeed` also
takes the `location` filter server-side). **Future multi-table feeds should
follow this pattern**, not a denormalized feed table (see
`docs/architecture/design-decisions.md`, "Unified feed via mergedStream").

- **Schema**: `saleBundles` and `saleEvents` gained `bumpedAt` (`v.number()`, mirrors
  `ads.bumpedAt`) + `boostCount` (optional, mirrors ads) + a
  `by_status_and_bumped_at` index (`["status", "bumpedAt"]`). Bundles stamp `bumpedAt`
  at insert; sales stamp at insert AND re-stamp at PUBLISH (draft → active) — the
  publish stamp is the one the feed ranks by.
- **`bumpedAt` on the composites is REQUIRED (`v.number()`) since 2026-07-19** —
  `migrations:backfillFeedBumpedAt` ran to completion on prod, then the validators were
  narrowed and the migration + the streams' interim `filterWith(bumpedAt !== undefined)`
  guards were deleted (widen→backfill→narrow, same as `ads.bumpedAt`; same postmortem
  rule — never narrow in the same deploy as the backfill). Every
  `insert("saleBundles")` / `insert("saleEvents")` MUST now set `bumpedAt` — including
  test fixtures and sale DRAFT creation (`createSaleEvent` stamps it at insert; publish
  re-stamps at draft → active so drafting time never feed-ranks).
- **mergedStream gotcha**: the order-fields argument must be the FULL non-equality
  suffix of each stream's index — `["bumpedAt", "_creationTime", "_id"]`, NOT bare
  `["bumpedAt"]` (the implicit system tie-breakers count). All three indexes end in
  `[..., "bumpedAt"]`, so after the composites' `.eq("status", "active")` every stream
  is ordered by exactly those fields.

```typescript
// convex/feed.ts (condensed)
import { stream, mergedStream } from "convex-helpers/server/stream";
const streams = [
  stream(ctx.db, schema).query("ads")
    .withIndex("by_bumped_at", (q) => q.lte("bumpedAt", maxSortTime))
    .order("desc")
    .filterWith(async (ad) => ad.isActive && ad.isDeleted !== true && ad.isSold !== true)
    .map(async (doc) => ({ kind: "ad" as const, doc })),
  stream(ctx.db, schema).query("saleBundles")
    .withIndex("by_status_and_bumped_at", (q) =>
      q.eq("status", "active").lte("bumpedAt", maxSortTime))
    .order("desc")
    .filterWith(async (b) => !b.saleEventId)
    .map(async (doc) => ({ kind: "bundle" as const, doc })),
];
// Full non-equality index suffix — NOT just ["bumpedAt"]
const result = await mergedStream(streams, ["bumpedAt", "_creationTime", "_id"])
  .paginate(args.paginationOpts);
```

Feature flags (`bundleListing`, `movingSaleMode`) are read server-side; a disabled flag
simply omits its stream. Composites are hydrated per page only; a bundle with <2 live
members is dropped from the page (can shrink a page by a card — accepted).

## Composites are ads — derived fields (Aug 2026) — READ before touching search or filters

`.agent/PRODUCT-RULES.md` rule 1: **an aggregation inherits from its members.** A
Bundle (`saleBundles`) or Moving Sale (`saleEvents`) has whatever its member ads
have. Rule 4: no ad type is exempt from any filter.

Until Aug 2026 both were excluded from the category filter and from search
entirely, and search returned Convex relevance order rather than `bumpedAt`. All
three were rule violations, not decisions — the `feed.ts` comment calling the
exclusion a "documented decision" described behaviour inherited from missing data.

### The mechanism

Composites carry **denormalised copies** of what their members have:

```ts
// on BOTH saleEvents and saleBundles
categoryIds: v.optional(v.array(v.id("categories"))),
searchText:  v.optional(v.string()),   // own label/title + every member title
locations:   v.optional(v.array(v.string())), // distinct canonical strings of the live members
```

Denormalisation rather than query-time derivation is forced, not chosen: **a search
index needs its text at index time.** There is no way to find a bundle by its
members' titles without those titles being on the bundle row. Given the field must
exist for search anyway, reusing the row for category and location is the smaller
diff, not a second mechanism.

`convex/lib/derive.ts` owns it — `deriveFromMembers(members, label?)` is pure and
unit-tested without a DB; `refreshCompositeDerived(ctx, target)` re-derives and
patches.

### The drift risk — this is the part that will bite

The derived fields are correct only if **every** mutation that changes membership,
or changes a member's `title` / `categoryId` / `location` / `isSold` / `isActive`,
calls `refreshCompositeDerived`. The PR that introduced the contract **missed four
sites** (`markBundleItemSold`, `markBundleSold`, `setItemSold`, `toggleAdStatus`) —
so treat "I'll remember" as already disproven.

Adding a mutation that writes to `ads`? Refresh the owning composites, and extend
the enumeration test that asserts derived fields match a fresh `deriveFromMembers`
after every such mutation. That test is the guard; keep it exhaustive.

Since 2026-08-26 the guard (`convex/lib/derive.test.ts`) scans **every** top-level
`convex/*.ts` module (not just the original four) — a new module's first mutation
fails the coverage test until classified. Widening it caught two real misses, both
fixed: `users.deleteAccount` hard-deleted the user's ads without detaching them
from bundles or refreshing composites, and `seed:seedMovingSale` inserted a
published sale with no derived fields at all (invisible to search/filters).
`refreshDistinctComposites` (bulk writes: refresh once per composite, never per
ad) now lives in `convex/lib/derive.ts`. The O(N²) guard test also passes
`transactionLimits: { documentsRead: 1000 }` to `convexTest` — convex-test leaves
limits DISABLED by default, so without an explicit cap a read-amplification
regression cannot fail a test.

### Gotchas worth the reading

- **`locations` is a LIST, like `categoryIds`** — a composite matches a location as
  soon as ANY member is there. It was a single string ("the first live member's")
  on the premise that a bundle's members share an address; nothing enforces that
  (`createBundle` takes any of the seller's ads), so the card was invisible to the
  second member's suburb while the member itself was not. Same shape, same
  any-member test, for both fields now.
- **`saleEvents.suburb` IS canonical since 2026-08-22.** The Moving Sale setup step
  used a bare free-text input, so `suburb` — copied onto every sale item as its
  `location` — could never equal a `formatLocation()` string, and Moving Sales were
  excluded from every location-filtered view. `SetupStep` now uses
  `src/components/ui/LocationPicker`; `migrations:backfillSaleSuburbLocations`
  resolves historical rows (an internalAction: the postcode dataset lives in
  `public/`, which a Convex function cannot read off disk, so it fetches the same
  file over HTTP and reports anything ambiguous rather than guessing). Display drops
  the postcode via `displayLocation()` — a view, never stored.
- **`categoryIds` is an array, so Convex cannot index it.** `filterFields` are
  equality-only over the whole value; array-contains is not expressible. Composite
  category/location narrowing is therefore a JS predicate, which must run *below*
  the per-table cap or out-of-scope rows consume the budget. Upgrade path if the
  tables ever grow: denormalise a scalar filter field and push it into the index.
- **Filters must run before hydration.** `hydrateBundleCard`/`hydrateSaleCard` read
  once per member ad, so hydrating an over-fetched candidate set is very expensive.
  Narrow, sort, slice, *then* hydrate.
- **A composite with no live members derives to empty** — no `categoryIds`, no
  `locations`. It drops out of every filtered view while still carrying its own
  title in `searchText`. That follows rule 1 literally.
- **"Live member" has ONE definition: `adIsVisible`.** Hydration and derivation must
  agree, or a card renders in the unfiltered feed and matches no filter. That was
  real: `hydrateSaleCard` counted every non-deleted item and had no despawn guard,
  so an all-sold sale rendered "12 items" with empty derived fields. Both hydrators
  now filter on `adIsVisible`, and both return `null` when nothing is left (a bundle
  below `BUNDLE_MIN_ITEMS`, a sale at zero) — `hydrateEntries` is the single
  enforcement site. `itemCount`, `photoCount`, prices and covers count visible
  members only.
- **A sale item is born `isActive: sale.status === "active"`.** `publishSaleEvent`
  only flips items that exist at publish time, and the wizard resumes a live sale at
  "review", from which upload is reachable — an unconditional `isActive: false` left
  those items rendering on the public page while contributing nothing derived.
- **The Sale feed card carries `prices: number[]`, not a min/max range.** A range
  overlap test admitted a sale holding a $5 mug and a $5000 couch into a $100–$200
  filter with nothing in the band (rule 5). `src/pages/HomePage.filterFeedForDisplay`
  asks "does any member price match?"; `minPrice` survives only as the "from $X"
  display floor.
- **A missing derived field never matches a filter.** `[].includes(x)` is `false`
  and an unset `searchText` is simply not indexed.
  **This is NOT the same as the read path being inert** — an earlier version of
  this note said it was, and that was wrong. Between deploy and backfill:
  - *category* and *search*: composites were already excluded pre-change, so no
    difference a user can see;
  - *location*: composites were **never** location-filtered before, so they
    always showed. Now they match nothing. **Every Bundle and Moving Sale
    disappears from a location-filtered feed until the backfill runs.**

  Self-healing and non-corrupting, but a real regression window. Run the
  backfill promptly after deploy; don't treat the gap as harmless.
- **Rollback needs a schema rollback.** Convex validators are strict, so once any
  composite row carries `categoryIds`/`searchText`/`locations`/`labelIsAuto`,
  deploying the pre-change schema fails with
  `Object contains extra field "categoryIds"`. Rows are written by the first
  ordinary user action (`createBundle`, `updateAd`, `deleteAd`, …), not only by
  the backfill, so this closes within minutes of deploy.

  **Accepted 2026-08-23: rollback is forward-fix only.** No strip migration was
  written — pre-launch, a broken deploy costs time, not users. If you ever need
  a real rollback: deploy an intermediate schema (old code + the four fields as
  `v.optional`), patch every composite row with those fields set to `undefined`,
  then deploy the old schema. `migrations.ts` documents the same trap from the
  `ads.bumpedAt` rollout.

### Search: relevance selects, date orders

Rule 2 is absolute — `bumpedAt` desc is the only thing that ever *orders* ads. But
a search index returns candidates by relevance, and the per-table `.take(n)` cap
cuts on relevance before the date sort ever runs. So a very old exact match can
fall out of the candidate pool entirely. Accepted knowingly (founder, Aug 2026) as
a ceiling at current inventory, not as a design goal — the `ponytail:` comments in
`convex/ads.ts` name it. Revisit when search feels lossy.

## Schema Overview

### Core Tables

#### ads
```typescript
{
  title: string;
  description: string;
  listingType?: "sale" | "exchange" | "both";  // Type of listing (defaults to "sale")
  price?: number;              // Required for "sale" and "both" types
  exchangeDescription?: string;// What seller wants in exchange (for "exchange"/"both")
  previousPrice?: number;      // For price reduction display
  location: string;
  latitude?: number;
  longitude?: number;
  categoryId: Id<"categories">;
  images: string[];              // R2 references or legacy storage IDs
  userId: Id<"users">;
  isActive: boolean;
  isDeleted?: boolean;           // Soft delete flag
  views: number;
  bumpedAt: number;              // REQUIRED — the feed sort key (see Boost section above)
  boostCount?: number;           // total boosts; future-pricing seam
  _creationTime: number;         // display-only ("Posted X ago") — NOT the feed order
}
```


**Indexes**:
- `by_user`: For user's listings
- `by_category`: For category filtering
- `by_deleted`: For excluding deleted ads
- `by_location`, `by_bumped_at`, `by_category_and_bumped_at`, `by_active`, `by_sale_event`
- `search_ads`: the search index (searchField `title`; filterFields `categoryId`,
  `location`, `isActive`, `isDeleted`). There is no `by_location_category` index —
  that entry was wrong and is corrected here.

#### users
```typescript
{
  name: string;
  email: string;
  image?: string;                // R2 reference
  isVerified: boolean;
  averageRating?: number;
  ratingCount?: number;
  tokenIdentifier: string;       // Descope user ID
  emailNotificationsEnabled?: boolean;  // Opt-in for email notifications
  _creationTime: number;
}
```

#### chats
```typescript
{
  adId: Id<"ads">;
  buyerId: Id<"users">;
  sellerId: Id<"users">;
  lastMessageAt: number;
  lastReadByBuyer?: number;
  lastReadBySeller?: number;
  archivedByBuyer?: boolean;
  archivedBySeller?: boolean;
}
```

## Query Patterns

### Filtering Deleted Ads
**Rule**: ALWAYS filter out soft-deleted ads in public queries.

```typescript
const ads = await ctx.db
  .query("ads")
  .withIndex("by_category", q => q.eq("categoryId", categoryId))
  .filter(q => q.neq(q.field("isDeleted"), true))
  .collect();
```

**Exception**: User's own dashboard can show deleted ads (for restoration).

### Pagination
**Pattern**: Use `.paginate()` for large result sets
```typescript
const result = await ctx.db
  .query("ads")
  .filter(q => q.neq(q.field("isDeleted"), true))
  .order("desc")
  .paginate(args.paginationOpts);

return {
  page: result.page,
  continueCursor: result.continueCursor,
  isDone: result.isDone,
};
```

### Search
**Pattern**: Use search indexes for text search
```typescript
// The index is `search_ads`, not `search_title`, and search results are
// CAPPED, never `.collect()`ed — a search index can't cursor-paginate.
const results = await ctx.db
  .query("ads")
  .withSearchIndex("search_ads", q =>
    q.search("title", args.searchTerm).eq("isActive", true)
  )
  .filter(q => q.neq(q.field("isDeleted"), true))
  .take(50);
```

## Mutation Patterns

### Authentication Check
**Rule**: ALWAYS verify user authentication in mutations.

```typescript
const userId = await getDescopeUserId(ctx);
if (!userId) {
  throw new Error("Must be logged in");
}
```

### Ownership Verification
**Pattern**: Check user owns resource before modification
```typescript
const ad = await ctx.db.get(args.adId);
if (!ad) throw new Error("Ad not found");
if (ad.userId !== userId) {
  throw new Error("You can only modify your own ads");
}
```

### Transaction-verified ratings (one-sided, Jul 2026)
**Pattern**: `ratings.submitRating` is buyer-rates-seller only, and requires a real
buyer→seller thread — the rater must appear as `buyerId` on a `chats` row whose
`sellerId` is the rated user. A chat row only exists after a first message
(`adDetail.sendFirstMessage`), so it's a genuine transaction proxy; and because a
seller is never the `buyerId` on their own listing's thread, this structurally blocks
seller→buyer retaliation ratings. Do NOT loosen this back to un-gated any-user-rates-any-user.
```typescript
const buyerThreads = await ctx.db
  .query("chats").withIndex("by_buyer", (q) => q.eq("buyerId", userId)).collect();
if (!buyerThreads.some((c) => c.sellerId === args.ratedUserId)) {
  throw createError("You can only rate a seller you've messaged", { ... });
}
```
UI mirrors this: `AdDetail`'s "Rate Seller" buttons are gated on `chatId` (existing
thread for this ad) so un-messaged buyers don't hit the error. Guard test:
`convex/ratings.test.ts`. Rationale: reputation only works as a trust signal if it's
transaction-verified and non-retaliatory (eBay dropped seller-rates-buyer in 2008).

### Soft Delete
**Pattern**: Mark as deleted instead of removing
```typescript
await ctx.db.patch(args.adId, {
  isDeleted: true,
  isActive: false,
  deletedAt: Date.now(), // REQUIRED at every soft-delete site — drives the image-cleanup cron
});
```

**Rationale**:
- Allows restoration
- Preserves data integrity (foreign keys)
- Enables cleanup jobs later

**Future restore mutation (none exists today)**: it must clear `deletedAt` AND decide
what to do with `bumpedAt` — restoring an old ad without touching `bumpedAt` quietly
buries it; re-stamping `bumpedAt` is a free boost that bypasses the cooldown. Make that
choice explicitly (and consider the boost cooldown) when a restore path is added.

### Rate Limiting
**Pattern**: Prevent abuse by limiting request frequency per user
**Location**: `convex/lib/rateLimit.ts`

```typescript
import { checkRateLimit } from "./lib/rateLimit";

// In mutation handler, after auth check:
await checkRateLimit(ctx, userId, "createAd");
```

**Configured Limits**:
| Operation | Limit | Window |
|-----------|-------|--------|
| createAd | 10 | 1 hour |
| updateAd | 30 | 1 hour |
| deleteAd | 20 | 1 hour |
| sendMessage | 60 | 1 minute |
| createReport | 5 | 1 hour |
| submitRating | 10 | 1 hour |
| generateUploadUrl | 50 | 1 hour |

**Calling rate-limit from an action (added 2026-05-09):** `checkRateLimit(ctx, ...)` is `MutationCtx`-typed and can't be called from an action directly. Use the `enforceRateLimit` `internalMutation` wrapper in `convex/lib/rateLimit.ts` and invoke via `ctx.runMutation(internal.lib.rateLimit.enforceRateLimit, { userId, operation: "..." })`. The 2026-05-09 audit (F2) found `generateUploadUrl` was declared in the limit table but not enforced; the wrapper closed that gap. Module-path access uses dotted form: `internal.lib.rateLimit.*`, NOT `internal["lib/rateLimit"]` — bracket form fails to type-check against the FilterApi.

**Index gotcha (added 2026-05-09):** `admin.getAllUsers` filters `isActive` post-query (`convex/admin.ts:30`) instead of using the `by_active` index. Acceptable at current scale but will full-scan the users table as it grows. Same pattern is OK in `admin.getAllFlyers` because it uses `by_category` first; the user-list path doesn't have a primary index to combine with.

**Rationale**:
- Prevents spam and abuse
- Protects system resources
- Uses uploads table for lightweight tracking

### Optimistic Updates
**Pattern**: Update immediately, rollback on error
```typescript
// Frontend
const optimisticUpdate = { ...item, status: 'active' };
setItems(prev => prev.map(i => i.id === item.id ? optimisticUpdate : i));

try {
  await mutation({ id: item.id, status: 'active' });
} catch (error) {
  // Rollback on error
  setItems(prev => prev.map(i => i.id === item.id ? item : i));
  toast.error("Failed to update");
}
```

## Action Patterns

### External API Calls
**Use actions for**:
- R2 presigned URL generation
- Nominatim location search
- Email sending (via Resend)
- Payment processing

**Pattern**:
```typescript
export const generateUploadUrl = action({
  args: { postId: v.string() },
  handler: async (ctx, args) => {
    // Verify auth
    const userId = await getUserId(ctx);
    
    // Call external API
    const url = await getSignedUrl(s3Client, command);
    
    return { url, key };
  }
});
```

**Note**: Actions run in Node.js environment, have access to npm packages.

## Real-time Patterns

### Subscriptions
**Pattern**: Queries automatically re-run on data changes
```typescript
// Frontend
const ads = useQuery(api.ads.getAds, { categoryId });

// Backend - no special code needed
export const getAds = query({
  handler: async (ctx, args) => {
    return await ctx.db
      .query("ads")
      .filter(q => q.eq(q.field("categoryId"), args.categoryId))
      .collect();
  }
});
```

**Result**: UI updates automatically when ads change.

### Optimistic Mutations
**Pattern**: Show result immediately, sync in background
```typescript
const { mutate } = useMutation(api.ads.toggleStatus);

const handleToggle = async (adId: string) => {
  // Optimistic update
  setAds(prev => prev.map(ad => 
    ad._id === adId ? { ...ad, isActive: !ad.isActive } : ad
  ));
  
  try {
    await mutate({ adId });
  } catch (error) {
    // Revert on error
    toast.error("Failed to update");
  }
};
```

## Statistics Patterns

### Aggregations
**Pattern**: Calculate stats in query
```typescript
export const getUserStats = query({
  handler: async (ctx) => {
    const userId = await getDescopeUserId(ctx);
    
    const ads = await ctx.db
      .query("ads")
      .withIndex("by_user", q => q.eq("userId", userId))
      .filter(q => q.neq(q.field("isDeleted"), true)) // Exclude deleted
      .collect();
    
    return {
      totalAds: ads.length,
      activeAds: ads.filter(ad => ad.isActive).length,
      totalViews: ads.reduce((sum, ad) => sum + ad.views, 0),
    };
  }
});
```

**Important**: Filter deleted ads to avoid inflated counts.

### Increments
**Pattern**: Atomic increment for counters
```typescript
export const incrementViews = mutation({
  args: { adId: v.id("ads") },
  handler: async (ctx, args) => {
    const ad = await ctx.db.get(args.adId);
    if (!ad) return;
    
    await ctx.db.patch(args.adId, {
      views: ad.views + 1,
    });
  }
});
```

## Relationship Patterns

### One-to-Many
**Example**: User has many ads

**Query**:
```typescript
const userAds = await ctx.db
  .query("ads")
  .withIndex("by_user", q => q.eq("userId", userId))
  .collect();
```

**Deletion**: Cascade delete (delete ads when user deleted)

### Many-to-Many
**Example**: Users save many ads, ads saved by many users

**Junction table**: `savedAds`
```typescript
{
  userId: Id<"users">;
  adId: Id<"ads">;
}
```

**Indexes**: `by_user`, `by_ad`

### Denormalization
**Pattern**: Store frequently accessed data redundantly

**Example**: Store seller info in chat
```typescript
// Instead of
const seller = await ctx.db.get(chat.sellerId);

// Denormalize
{
  chat: { ...chat },
  seller: {
    name: seller.name,
    averageRating: seller.averageRating,
    // Only fields needed for display
  }
}
```

**Trade-off**: Faster reads, more complex updates.

## Migration Patterns

### Schema Changes
**Pattern**: Add optional fields, backfill later
```typescript
// 1. Add optional field to schema
isDeleted: v.optional(v.boolean())

// 2. Deploy schema change

// 3. Backfill existing records
export const backfillIsDeleted = internalMutation({
  handler: async (ctx) => {
    const ads = await ctx.db.query("ads").collect();
    for (const ad of ads) {
      if (ad.isDeleted === undefined) {
        await ctx.db.patch(ad._id, { isDeleted: false });
      }
    }
  }
});
```

### Data Migrations
**Pattern**: Use internal mutations for batch updates
```typescript
export const migrateImages = internalMutation({
  args: { batchSize: v.number() },
  handler: async (ctx, args) => {
    const ads = await ctx.db
      .query("ads")
      .filter(q => /* needs migration */)
      .take(args.batchSize);
    
    for (const ad of ads) {
      // Migrate data
      await ctx.db.patch(ad._id, { /* new format */ });
    }
    
    return { migrated: ads.length };
  }
});
```

**Run**: `npx convex run migrations:migrateImages --batchSize 100`

## Performance Optimization

### Index Usage
**Rule**: Use indexes for frequently queried fields
```typescript
// Good - uses index
.withIndex("by_user", q => q.eq("userId", userId))

// Bad - full table scan
.filter(q => q.eq(q.field("userId"), userId))
```

### Limit Results
**Pattern**: Use `.take()` or `.paginate()` for large sets
```typescript
const recentAds = await ctx.db
  .query("ads")
  .order("desc")
  .take(20); // Only fetch what's needed
```

### Batch Operations
**Pattern**: Fetch related data in parallel
```typescript
const [ads, categories, users] = await Promise.all([
  ctx.db.query("ads").collect(),
  ctx.db.query("categories").collect(),
  ctx.db.query("users").collect(),
]);
```

## Common Mistakes

❌ **Don't**: Forget to filter deleted ads
✅ **Do**: Always add `.filter(q => q.neq(q.field("isDeleted"), true))`

❌ **Don't**: Use full table scans
✅ **Do**: Create and use indexes

❌ **Don't**: Return entire documents when only few fields needed
✅ **Do**: Select only required fields

❌ **Don't**: Forget authentication checks
✅ **Do**: Verify user in every mutation

❌ **Don't**: Hard delete data
✅ **Do**: Use soft delete pattern
