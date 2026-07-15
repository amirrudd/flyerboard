# Database Patterns & Convex

**Last Updated**: 2026-07-15

## Boost feed ordering (Phase 1B, Jul 2026) — READ FIRST if touching the feed

- **`ads.bumpedAt` is THE feed sort key, and it is REQUIRED (`v.number()`).** The feed
  (`convex/ads.ts` `getAds` + `getLatestAds`, non-search branches) orders by `bumpedAt`
  desc via the `by_bumped_at` and `by_category_and_bumped_at` indexes — NOT
  `_creationTime`. `_creationTime` is now display-only ("Posted X ago"). A boost
  (`convex/posts.ts` `boostAd`) re-stamps `bumpedAt = Date.now()`, lifting the ad to top.
  - `getAds` arg is `maxSortTime` (renamed from `maxCreationTime`) — a `bumpedAt` upper
    bound. Category branches apply the `bumpedAt` bound in the **post-filter** (the
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
  public `getSetting(key)` (clamped on read for known boost keys, returns `number|null`),
  admin-gated `getAllSettings`/`updateSetting` (rejects out-of-range, `logAdminAction`).
  Keys: `boostCooldownDays` (default 7, 1–30), `boostDailyCap` (default 3, 1–20). Shared
  constants/clamps live in `convex/lib/boost.ts` (frontend-safe — NO server imports).
  Seed via `migrations:seedAppSettings`. Client reads via `src/hooks/useAppSetting.ts`.
- **Runtime-configurable rate limit**: `checkRateLimitDynamic(ctx, userId, op, max, windowMs)`
  in `convex/lib/rateLimit.ts` takes max/window at call time (reuses the same
  `ratelimit:${userId}:${op}` uploads-table storage). `boostAd` uses it with the
  admin-configured cap (clamped ≤ 20 = the static `RATE_LIMITS.boostAd` backstop ceiling),
  so ONE rate-limit row per boost enforces both. Convex transactional rollback means only
  SUCCESSFUL boosts consume budget. Don't ALSO call `checkRateLimit` for the same op —
  that double-inserts. Feature flag `boostToTop` gates `boostAd` server-side (fail closed).

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
- `by_location_category`: Search index

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
const results = await ctx.db
  .query("ads")
  .withSearchIndex("search_title", q => 
    q.search("title", args.searchTerm)
  )
  .filter(q => q.neq(q.field("isDeleted"), true))
  .collect();
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
