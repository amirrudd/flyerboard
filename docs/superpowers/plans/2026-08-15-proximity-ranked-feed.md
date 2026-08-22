# Proximity-Ranked Feed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Two things, in this order.

1. **Fix what's already broken.** Bundles and Moving Sales are excluded from the category filter and from search entirely, and search ignores date order. All three break `.agent/PRODUCT-RULES.md`. Fix them first — they ship unflagged, because a rule violation is a bug.
2. **Then** make picking a location stop hiding everything else: ads within the chosen radius first (newest-first), then everything else below a labelled divider, on the feed and in search — behind the `proximityFeed` flag.

**Architecture:** One idea carries the whole plan — **an aggregation inherits from its members** (rule 1). A Bundle or Moving Sale has no category, location, or searchable text of its own; it has whatever its member ads have. Those inherited values are **denormalised onto the composite row** at write time, because a search index needs its text at index time and `mergedStream` needs real index fields. Once composites carry `categoryIds` and `searchText` (Phase A), and `latitude`/`longitude` (Phase B), every exclusion branch in `feed.ts` and `ads.ts` gets **deleted, not replaced**. The rule-correct version is less code than what's there now.

**Tech Stack:** Convex (queries, `convex-helpers/server/stream`, `featureFlags`, `internalMutation` migrations), React 19 + React Router v7, Tailwind v4, Phosphor icons, framer-motion via `useMotionPrefs()`, vitest + `convex-test` (edge-runtime), vitest + jsdom, Playwright for visual snapshots.

**Spec:** `ResearchLab/ideas/proximity-ranked-feed.md` — read the OVERRIDING CONTEXT block first.
**Rules:** `.agent/PRODUCT-RULES.md` — binding. Run the `product-guardian` agent before merging each phase.

---

## What changed from the previous draft, and why

| Was | Now | Why |
|---|---|---|
| **Composites excluded from located feeds** | **Composites participate in everything** | Rule 1: an aggregation inherits from its members. Rule 4: no ad type is exempt from a filter. The old draft cited a `feed.ts` code comment calling this a "documented decision" — that comment describes behaviour inherited from missing data, and carries no authority (`PRODUCT-RULES.md`, Notes). |
| Proximity was the whole plan | **Phase A fixes shipped rule violations, unflagged; Phase B adds proximity, flagged** | Founder's sequencing: fix existing functionality before building new. Phase A stands alone and is worth merging on its own. |
| Search kept Convex relevance order | **Search orders by `bumpedAt` desc** | Rule 2: `bumpedAt` descending is the only thing that ever orders ads. Relevance decides *which* ads are candidates; date decides the order. |
| Composites needed geocoding "later" (Deferred) | **Derived from member coordinates in Phase A** | They were only ungeocodable because nobody derived them. Members have suburbs; the postcode file resolves them. |
| 5 distance buckets | **2 tiers: near / far** | One divider renders and per-card distance is coarse, so buckets 1–4 were an ordering nobody could perceive — while pushing the newest ad in the country behind older, slightly-nearer ones. |
| `maximumRowsRead` + "That's everything within 10 km" | **Copy weakened to match what the query proves** | The early-abandon guard stops before proving a tier is empty; the old copy asserted completeness anyway — the defect observed live on eBay ("from eBay international sellers" over domestic items). |
| Chips inside the dropdown | **Dropdown stays open in a confirm state** | Selecting a suburb calls `setIsOpen(false)` (`Header.tsx:213`), so the chips could never be seen. The old plan's own verification step was unpassable. |
| Grid empties on every change | **Seed the new cache key, dim instead of unmount** | A radius tap wiped the feed to 12 skeletons and lost scroll position. |
| No per-card distance (privacy) | **`~15 km` rounded to 5 km, far tier only** | Ads sit on *suburb centroids* and the suburb name is already on the card, so a 5-km band discloses nothing new. Trilateration needs sub-suburb resolution; this has none. |
| Divider is a dead end | **Divider carries a "Widen to 25 km" action** | It is the moment of maximum intent. |

**Flagged for the founder, not decided:** default radius is **10 km** per your call. At ~100 national listings that makes "nothing nearby" the *median* outcome, so the median located user meets an empty-tier banner. The flag lets you test it cheaply; raising the default is a one-line change (`DEFAULT_RADIUS_KM` in `src/lib/radius.ts`).

---

## Global Constraints

- **Newest-first inside whatever is being shown. This is the invariant (rule 2).** Sort key stays `bumpedAt` desc, everywhere, including search. Never add a sort control.
- **All three ad types are eligible for every filter (rule 4).** After Phase A, any new `kind === "ad"` carve-out is a bug.
- **A composite's category, location, and search text come from its members (rule 1).** Never let a composite hold its own authored copy that can drift from them.
- **Soft delete always.** Every ad query keeps `isActive === true`, `isDeleted !== true`, `isSold !== true`.
- **Phase A ships unflagged.** It corrects rule violations in shipped code. Phase B is entirely behind `proximityFeed` — flag off ⇒ byte-identical to end-of-Phase-A.
- **Boost stays a refresh, not a pin (rule 3).** A boost re-stamps `bumpedAt`; rule 2 carries it up on its own, and it sinks again. Tiering is a filter phase, not a change to the sort key, so `boost-monetisation.md`'s "one shared sort key, no special cases in the query" still holds.
- **Default radius 10 km.** Options `5`, `10`, `25`, `50`, `Anywhere`. `Anywhere` disables tiering entirely.
- **An ad with no coordinates is `far`. Never drop it.**
- **Never claim completeness the query didn't establish.** Copy says what was found, not what exists.
- **Never show sub-suburb precision.** Distances rounded to 5 km, far tier only.
- **Touch targets ≥ 44px.** Mobile-first.
- Copy is Australian and understated. Brand primary `#dc3626` via `bg-primary`; `font-display` headings; existing `kicker` / `hairline` classes; Phosphor at 16/20/24px.
- Run `npm run lint` before calling any task done.

---

## File Structure

**Create:**
- `convex/lib/derive.ts` + `convex/lib/derive.test.ts` — composite derivation from member ads.
- `convex/lib/geo.ts` + `convex/lib/geo.test.ts` — distance and tier maths. Dependency-free.
- `src/lib/radius.ts` — radius options and the widen helper.
- `src/features/ads/NearbyBoundary.tsx` — divider and empty-tier banner.
- `scripts/backfill-ad-coords.mjs` — one-off coordinate backfill.

**Modify:**
- `convex/schema.ts` — coordinates + derived fields + search indexes on composites.
- `convex/posts.ts` — store coordinates on create/update; refresh owning composites.
- `convex/bundles.ts`, `convex/saleEvents.ts` — refresh derived fields on membership change.
- `convex/migrations.ts` — backfill helpers.
- `convex/feed.ts` — composites in the category branch; Phase B two-tier query.
- `convex/ads.ts` — search across all three tables, `bumpedAt`-ordered; `getLatestAds` fix.
- `src/features/layout/Header.tsx` — dropdown confirm state, labelled mobile pill, radius chips.
- `src/context/MarketplaceContext.tsx` — radius state, origin resolution, cache seeding, tier ordering.
- `src/features/ads/AdsGrid.tsx` — divider, banner, header count, live region.
- `src/features/ads/PostAd.tsx` — capture coordinates, seller reach line.
- Tests: `convex/feed.test.ts`, `convex/ads.test.ts`, `convex/posts.test.ts`, `convex/bundles.test.ts`, `src/features/ads/AdsGrid.test.tsx`, `e2e/` snapshot.

---

# PHASE A — Composites are ads (rule fixes, unflagged)

> **Deploy order is load-bearing.** Once Task A3 lands, a composite with no
> `categoryIds` is invisible under **every** category — correct by construction,
> but it means `backfillCompositeDerived` (Task A2) is a hard prerequisite for
> shipping A3 to prod, not an independent task. Same for `searchText` and A4.
> Order: deploy the schema + write path, run the backfill against
> `resilient-pheasant-112`, verify zero rows lack the derived fields, **then**
> deploy the read-path changes. This is the same widen → backfill → narrow
> rollout `ads.bumpedAt` used.


Three shipped violations, one root cause. Merge Phase A on its own.

| # | Rule | Violation | Fixed by |
|---|---|---|---|
| 1 | 4 | Composites excluded from search entirely (`convex/ads.ts:34-52`) | Task A4 |
| 2 | 4 | Category filter excludes composites (`convex/feed.ts:118-143`) | Task A3 |
| 3 | 2 | Search ordered by relevance, not `bumpedAt` (`convex/ads.ts:34-52`, `:174-198`) | Task A4 |

---

### Task A1: Ads know where they are — **MOVED TO PHASE B**

> Coordinates are needed only for *tiering*, not for any rule fix. Phase A needs
> `categoryIds` and `searchText` and nothing else. This task and the `latitude`/
> `longitude` half of Task A2 both moved to Phase B, where they are the input to
> Task B2. The composite derived-field shape is additive, so extending
> `deriveFromMembers` with a first-coordinated-member rule later is a clean change.

<details>
<summary>Original Task A1 (execute as the first task of Phase B)</summary>


Coordinates are the input to everything downstream — composite derivation (A2) and tiering (B2). `convex/schema.ts:38-39` already declares `latitude`/`longitude` on `ads`; only `sampleData.ts` ever writes them.

**Files:** Modify `convex/posts.ts`, `convex/migrations.ts`, `src/features/ads/PostAd.tsx`, `convex/sampleData.ts`; create `scripts/backfill-ad-coords.mjs`; test `convex/posts.test.ts`

**Interfaces:**
- Produces: every new and edited ad carries `latitude`/`longitude` matching its suburb centroid; every existing ad backfilled.

- [ ] **Step 1: Write the failing test**

Append to `convex/posts.test.ts`: creating an ad with `location: "Bondi, NSW 2026"` and explicit `latitude`/`longitude` persists both; editing the location to a different suburb replaces them; omitting them leaves the ad findable but uncoordinated (never rejected — rule: an ad with no coordinates is `far`, not dropped).

- [ ] **Step 2: Accept coordinates in the mutations**

Add `latitude: v.optional(v.number())`, `longitude: v.optional(v.number())` to the `args` of `createPost` and `updatePost` in `convex/posts.ts`, and write them through on insert/patch. Optional, not required — a client that doesn't send them must still be able to post.

- [ ] **Step 3: Stop discarding them on the client**

`src/features/ads/PostAd.tsx:128` — `handleLocationSelect` receives a `LocationData` with `lat`/`long` and keeps only the formatted string. Keep the coordinates in form state and pass them to the mutation.

- [ ] **Step 4: Backfill existing ads**

`scripts/backfill-ad-coords.mjs`: load `public/australian-postcodes.json`, build a `formatLocation(loc) -> {lat, long}` map, and call an `internalMutation` in `convex/migrations.ts` that patches ads with no coordinates whose `location` resolves. Log the unresolvable ones by location string — do not guess.

- [ ] **Step 5: Fix the seed data**

`convex/sampleData.ts` emits 13 location strings (`"Sydney, CBD"`, `"Richmond, VIC"`) — **none resolve** against the postcode file and none are `formatLocation()` output. Replace them with real canonical strings and their real centroids, so seeded ads behave like posted ones.

- [ ] **Step 6: Verify**

Run: `npx vitest run convex/posts.test.ts`
Expected: PASS. Then `npm run lint`.

---

</details>

---

### Task A2: A composite inherits from its members

The load-bearing task. Composites get denormalised copies of what their members have, refreshed whenever membership or a member changes.

**Why denormalise rather than derive at query time:** a search index needs its text at index time — there is no way to search a bundle by its members' titles without storing those titles on the bundle row. Given the field must exist for search, reusing the same row for category and coordinates is the smaller diff, not a second mechanism.

**Files:** Create `convex/lib/derive.ts`, `convex/lib/derive.test.ts`; modify `convex/schema.ts`, `convex/bundles.ts`, `convex/saleEvents.ts`, `convex/posts.ts`, `convex/migrations.ts`

**Interfaces:**
- Produces: `deriveFromMembers(members, label?): { categoryIds, searchText }`; `refreshCompositeDerived(ctx, { bundleId } | { saleEventId })`.
- **The label is a second argument**, not a member field — a composite's own title is authored, only its members' titles are inherited.

- [ ] **Step 1: Write the failing test**

Create `convex/lib/derive.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { deriveFromMembers } from "./derive";

const ad = (o: Partial<Parameters<typeof deriveFromMembers>[0][number]>) => ({
  title: "Thing", categoryId: "c1", latitude: -33.89, longitude: 151.27, ...o,
}) as Parameters<typeof deriveFromMembers>[0][number];

describe("deriveFromMembers", () => {
  test("collects every distinct member category", () => {
    const d = deriveFromMembers([ad({ categoryId: "furniture" }), ad({ categoryId: "tools" })]);
    expect(d.categoryIds.sort()).toEqual(["furniture", "tools"]);
  });

  test("a member's title makes the composite findable", () => {
    const d = deriveFromMembers([ad({ title: "Oak desk" }), ad({ title: "Office chair" })]);
    expect(d.searchText).toContain("Oak desk");
    expect(d.searchText).toContain("Office chair");
  });

  // PHASE B ONLY — add these when Task B1 lands, alongside the coordinate fields.
  // test("location is the first coordinated member's", ...)
  // test("no coordinated members leaves it uncoordinated, not zeroed", ...)

  test("no members is safe", () => {
    expect(deriveFromMembers([])).toEqual({ categoryIds: [], searchText: "" });
  });
});
```

- [ ] **Step 2: Write `convex/lib/derive.ts`**

Pure, dependency-free. `categoryIds` = distinct member categories. `searchText` = the composite's own label/title, then every member title.

**Phase B extends this** with `latitude`/`longitude` = the first coordinated member's — **not a centroid**: the average of two suburbs is a point in neither, and members of a real bundle or sale are collected from one place. `// ponytail: first-member coordinates, not a centroid. Revisit only if multi-suburb composites become real.`

- [ ] **Step 3: Add the fields and the search indexes**

In `convex/schema.ts`, add to **both** `saleEvents` and `saleBundles`:

```ts
    // Derived from member ads — rule 1, "an aggregation inherits from its members".
    // Never authored directly. Refreshed by refreshCompositeDerived() on every
    // membership change and on any member ad's location/category/title edit.
    categoryIds: v.optional(v.array(v.id("categories"))),
    searchText: v.optional(v.string()),
    // Phase B adds: latitude / longitude, same derivation, same refresh sites.
```

and a search index on each:

```ts
    .searchIndex("search_composite", {
      searchField: "searchText",
      filterFields: ["status", "isDeleted"],
    }),
```

(`saleEvents` has no `isDeleted`; use `["status"]` there.)

**Note:** `categoryIds` is an array and Convex cannot index array-contains, so the category filter uses `filterWith` on the composite streams (Task A3). That is fine — the composite tables are tiny next to `ads`, and the field is on the row, so the predicate reads nothing extra.

- [ ] **Step 4: Write the refresh helper**

`refreshCompositeDerived(ctx, target)` in `convex/lib/derive.ts` (ctx-taking half): load the member ads (`bundle.adIds`, or `ads.by_sale_event` for a sale), call `deriveFromMembers`, patch the composite. Call it from every site that changes membership or a member:

| Site | File |
|---|---|
| `createBundle`, `removeBundleItem`, `cancelBundle` | `convex/bundles.ts:161,268,297` |
| `addSaleItems`, `removeSaleItem`, `updateSaleItem` | `convex/saleEvents.ts:236,318,352` |
| `updatePost` when `location`/`categoryId`/`title` changed | `convex/posts.ts` — refresh the ad's `bundleId` and `saleEventId` if set |

- [ ] **Step 5: Backfill**

Add `backfillCompositeDerived` to `convex/migrations.ts`: iterate every `saleEvents` and `saleBundles` row, run the same helper. Idempotent — safe to re-run. Run against dev first, then prod (`resilient-pheasant-112`).

- [ ] **Step 6: Verify**

Run: `npx vitest run convex/lib/derive.test.ts convex/bundles.test.ts`
Expected: PASS. Then `npm run lint`.

---

### Task A3: The category filter stops excluding composites

**Rule 4 violation.** `convex/feed.ts:118-143` takes a separate ads-only path when `categoryId` is set, so a bundle containing a desk never appears under Furniture.

**Files:** Modify `convex/feed.ts`, `convex/feed.test.ts`

**Interfaces:**
- Produces: `getFeed` with `categoryId` returns the same discriminated union as the uncategorised branch, including composites whose `categoryIds` contains the category.

- [ ] **Step 1: Write the failing test**

Append to `convex/feed.test.ts`: a bundle whose member ad is in `furniture` appears in `getFeed({ categoryId: furniture })`; a bundle none of whose members are in `furniture` does not; a Moving Sale behaves the same; composites and ads interleave strictly by `bumpedAt` desc.

- [ ] **Step 2: Delete the category branch**

Remove the whole `if (args.categoryId) { ... }` block at `convex/feed.ts:118-143`. Move the category predicate into the shared stream builder instead:

- ads stream — `.withIndex("by_category_and_bumped_at", …)` when `categoryId` is set, as today, so the index still does the work
- composite streams — add `(!args.categoryId || (c.categoryIds ?? []).includes(args.categoryId))` to the existing `filterWith`

Everything after that — `mergedStream`, hydration, the response shape — is already shared and needs no change. **The diff is net-negative.**

- [ ] **Step 3: Fix the doc comment**

`convex/feed.ts:96-97` says *"the feed is ads-only — composites never appear on category feeds (documented decision)"*. Delete it. Replace with a pointer, not a restatement:

```ts
 * @param args.categoryId - Category filter (optional). Applies to all three ad
 *   types; a composite matches when any member ad is in the category (rule 1,
 *   `.agent/PRODUCT-RULES.md`).
```

- [ ] **Step 4: Verify**

Run: `npx vitest run convex/feed.test.ts`
Expected: PASS, including the pre-existing case at `convex/feed.test.ts:419` — **read it first**; it likely asserts the old exclusion and must be rewritten, not deleted.

---

### Task A4: Search finds composites, newest first

**Two rule violations at once.** `getAds` queries only `ads` (rule 4), and returns Convex's relevance order verbatim (rule 2).

Search is not cursor-paginated today — `.take(50)`, `isDone: true` (`convex/ads.ts:52-58`) — so merging three result sets and re-sorting in memory costs nothing.

**Files:** Modify `convex/ads.ts`, `convex/ads.test.ts`

**Interfaces:**
- Produces: `getAds` returns the same `{ page, isDone, continueCursor }` envelope, with `page` now a discriminated union matching `getFeed`'s, ordered by `bumpedAt` desc.

- [ ] **Step 1: Write the failing test**

Append to `convex/ads.test.ts`:

```ts
test("a bundle whose member is a desk is found by 'desk'", async () => {
  // …seed an ad titled "Oak desk" inside a bundle labelled "Home office setup"
  const r = await t.query(api.ads.getAds, { search: "desk", paginationOpts: PAGE });
  expect(r.page.some((e) => e.kind === "bundle")).toBe(true);
});

test("results are newest-first, not relevance-first", async () => {
  // …seed an old ad titled exactly "sofa" and a newer one titled "sofa bed, barely used"
  const r = await t.query(api.ads.getAds, { search: "sofa", paginationOpts: PAGE });
  const times = r.page.map((e) => (e.kind === "ad" ? e.ad.bumpedAt : e.card.bumpedAt));
  expect(times).toEqual([...times].sort((a, b) => b - a));
});
```

- [ ] **Step 2: Search all three tables**

In `getAds`, run the existing `search_ads` query plus one `search_composite` query per composite table, gated on the same `bundleListing` / `movingSaleMode` flags `getFeed` reads. Then:

```ts
    // Relevance selects the candidates; date orders them (rule 2).
    // ponytail: the 50-per-table cap is a relevance cut — a very old exact match can
    // fall out of the pool. Fine at current inventory; revisit if search feels lossy.
    const merged = [...adHits, ...bundleHits, ...saleHits]
      .sort((a, b) => b.bumpedAt - a.bumpedAt)
      .slice(0, 50);
```

Hydrate composites with the **existing** `hydrateBundleCard` / `hydrateSaleCard` from `convex/feed.ts` — export them rather than writing second copies, so a card shape can never diverge between feed and search.

- [ ] **Step 3: Same treatment for `getLatestAds`**

`convex/ads.ts:174-198` — the search branch of the 60s fresh rail has the same two defects. Apply the same merge, keeping the `sinceTimestamp` watermark.

- [ ] **Step 4: Update the callers**

`getAds`' page shape changes from `Doc<"ads">[]` to the union. Grep every caller — at least `MarketplaceContext` and `CommandPalette` — and handle `kind`. The union already has renderers; reuse them.

- [ ] **Step 5: Verify**

Run: `npx vitest run convex/ads.test.ts && npm run lint`
Expected: PASS.

- [ ] **Step 6: Guardian pass and commit**

Run the `product-guardian` agent over the Phase A diff. Expect: the three violations above resolved, and no new `kind === "ad"` carve-out introduced.

```bash
git commit -m "fix(feed): composites are ads — category, search, and date order per PRODUCT-RULES"
```

---

# PHASE B — Proximity tiering (behind `proximityFeed`)

Flag off ⇒ byte-identical to end-of-Phase-A. Do not start until Phase A is merged.

---

### Task B1: Distance and tier maths

**Files:** Create `convex/lib/geo.ts`, `convex/lib/geo.test.ts`

**Interfaces:**
- Produces: `distanceKm(aLat, aLon, bLat, bLon): number`; `isNear(distance, radiusKm): boolean`; `roundedBand(distance): number` (nearest 5 km, minimum 5).

- [ ] **Step 1: Write the failing test**

Create `convex/lib/geo.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { distanceKm, isNear, roundedBand } from "./geo";

const SYDNEY = { lat: -33.8688, lon: 151.2093 };
const MELBOURNE = { lat: -37.8136, lon: 144.9631 };
const SURRY_HILLS = { lat: -33.8845, lon: 151.2119 };

describe("distanceKm", () => {
  test("Sydney to Melbourne is about 713km", () => {
    const d = distanceKm(SYDNEY.lat, SYDNEY.lon, MELBOURNE.lat, MELBOURNE.lon);
    expect(d).toBeGreaterThan(700);
    expect(d).toBeLessThan(725);
  });

  test("a point to itself is zero", () => {
    expect(distanceKm(SYDNEY.lat, SYDNEY.lon, SYDNEY.lat, SYDNEY.lon)).toBe(0);
  });

  test("Sydney CBD to Surry Hills is under 3km", () => {
    expect(distanceKm(SYDNEY.lat, SYDNEY.lon, SURRY_HILLS.lat, SURRY_HILLS.lon)).toBeLessThan(3);
  });
});

describe("isNear", () => {
  test("inside and exactly on the radius are both near", () => {
    expect(isNear(0, 10)).toBe(true);
    expect(isNear(9.9, 10)).toBe(true);
    expect(isNear(10, 10)).toBe(true);
  });

  test("past the radius is far", () => {
    expect(isNear(10.1, 10)).toBe(false);
    expect(isNear(800, 10)).toBe(false);
  });
});

describe("roundedBand", () => {
  test("rounds to 5km bands with a 5km floor", () => {
    expect(roundedBand(0.4)).toBe(5);
    expect(roundedBand(12)).toBe(10);
    expect(roundedBand(13)).toBe(15);
  });
});
```

- [ ] **Step 2: Write `convex/lib/geo.ts`**

Haversine, ~8 lines, no dependency. `// ponytail: sphere approximation, ~0.5% error (50 m over 10 km). Ellipsoid only if we ever show a precise number — we round to 5 km, so we never will.`

- [ ] **Step 3: Verify**

Run: `npx vitest run convex/lib/geo.test.ts`

---

### Task B2: The two-tier feed

**Files:** Modify `convex/feed.ts`, `convex/feed.test.ts`

**Interfaces:**
- Consumes: `distanceKm`/`isNear`; `isFlagEnabled(ctx, "proximityFeed")`.
- Produces: `getFeed` accepts `originLat`, `originLng`, `radiusKm`; every page entry carries `tier: "near" | "far"` and, on far entries, `bandKm`.

- [ ] **Step 1: Write the failing test**

Append to `convex/feed.test.ts`: with the flag off, an origin+radius changes nothing (**assert this first — it is the safety property**); with the flag on, near ads precede far ads, `bumpedAt` desc holds strictly *within* each tier, an uncoordinated ad lands in `far` and is never dropped, and **a bundle whose members are local lands in `near`** (rule 4 — no type-based carve-out).

- [ ] **Step 2: Add the arguments and the flag gate**

Three optional args on `getFeed`. When the flag is off, or `radiusKm` is absent, or the origin is absent, take exactly today's path — no new branch downstream.

- [ ] **Step 3: Two passes over one stream set**

Build the same stream set twice, differing only in the `filterWith` tier predicate — near first, then far. `paginationOpts.cursor` carries which phase it is in (prefix the cursor, e.g. `near:<cursor>` / `far:<cursor>`); when the near phase reports `isDone`, the next page starts the far phase.

The tier predicate is the same expression for ads and composites, because after Task A2 both carry `latitude`/`longitude`:

```ts
const tierOf = (row: { latitude?: number; longitude?: number }) =>
  row.latitude === undefined || row.longitude === undefined
    ? "far" as const
    : isNear(distanceKm(args.originLat!, args.originLng!, row.latitude, row.longitude), args.radiusKm!)
      ? "near" as const
      : "far" as const;
```

- [ ] **Step 4: Guard the sparse case**

Pass `maximumRowsRead` to the near phase so a Bondi user with nothing nearby doesn't scan the whole table. **This is why the divider copy may not claim completeness** — the guard can end the near phase before proving it empty.

- [ ] **Step 5: Stamp the tier on every entry**

`tier` goes on each entry, not as a page-level index, because the fresh rail splices arrivals into the client array (Task B5) and any index would be stale the moment it does.

- [ ] **Step 6: Verify**

Run: `npx vitest run convex/feed.test.ts`

---

### Task B3: Search tiering without losing local recall

**Files:** Modify `convex/ads.ts`, `convex/ads.test.ts`

Naively dropping `.eq("location")` from the search index spends the 50-candidate budget nationally — a Bondi user searching "sofa" gets 3 local results instead of 50. That is a **recall regression**, the opposite of the goal.

**Interfaces:**
- Produces: `getAds` accepts the same three proximity args; results are near-tier then far-tier, `bumpedAt` desc within each.

- [ ] **Step 1: Write the failing test**

Append to `convex/ads.test.ts`: with 60 local "sofa" ads and 200 national ones, a located search returns local matches first and **not fewer local results than an unlocated search would have** (the recall guard); the flag off is unchanged.

- [ ] **Step 2: Two passes**

Pass 1 keeps the index-level location narrowing that protects local recall. Pass 2 runs open, minus pass 1's ids. Merge: pass 1 (tier `near`) then pass 2 (tier `far`), each `bumpedAt` desc.

Note that pass 1 narrows by **location string equality**, not radius — the index can do string equality and cannot do distance. Ads inside the radius but in a neighbouring suburb arrive via pass 2 and are re-tiered to `near` by the same `tierOf` predicate. The two-pass split is a recall device, not the tier boundary.

- [ ] **Step 3: Verify**

Run: `npx vitest run convex/ads.test.ts`

---

### Task B4: A location control people can actually find

Three defects block this on a phone: the dropdown closes before the radius chips render, the chips are ~26px, and the mobile pill is an unlabelled icon.

**Files:** Create `src/lib/radius.ts`; modify `src/features/layout/Header.tsx:168-260`, `:352-395`; `src/context/MarketplaceContext.tsx` (radius state only)

**Interfaces:**
- Produces: `RADIUS_OPTIONS`, `DEFAULT_RADIUS_KM`, `ANYWHERE`, `nextRadius(km): number | null`; context gains `radiusKm` / `setRadiusKm`.

- [ ] **Step 1: Add the radius constants**

Create `src/lib/radius.ts`:

```ts
/** Radius choices in the location panel, in kilometres. */
export const RADIUS_OPTIONS = [5, 10, 25, 50] as const;

/**
 * Radius applied when a suburb is picked and the user hasn't chosen one.
 *
 * NOTE: at low inventory this makes "nothing nearby" the common outcome. If the
 * empty state reads badly in practice, raising this to 25 is a one-line change.
 */
export const DEFAULT_RADIUS_KM = 10;

/** Sentinel: rank by nothing, show one plain list, no divider. */
export const ANYWHERE = 0;

/** The next wider option, for the divider's widen button. null at the top. */
export function nextRadius(km: number): number | null {
  return RADIUS_OPTIONS.find((r) => r > km) ?? null;
}
```

- [ ] **Step 2: Keep the panel open after a suburb is picked**

`Header.tsx:213` calls `setIsOpen(false)` on select. Replace with a confirm state: the panel stays open showing the chosen suburb and the radius chips, with a primary "Show flyers" button that closes it and returns focus to the pill.

- [ ] **Step 3: Radius chips at ≥44px**

Render `RADIUS_OPTIONS` plus `Anywhere` as chips. Selected chip uses `bg-primary`. Each chip ≥44px tall.

- [ ] **Step 4: Label the mobile pill**

`Header.tsx:370-375` renders `compact` as a bare icon. Show `Bondi · 10 km`, or `Anywhere` when nothing is set, truncating the suburb rather than dropping the radius.

- [ ] **Step 5: Verify**

Manual at 360px: pick a suburb, chips are visible and tappable, pill reads back the selection.

---

### Task B5: Wire it up without wiping the feed

**Files:** Modify `src/context/MarketplaceContext.tsx:110-300`

**Interfaces:**
- Consumes: `fetchLocations`/`formatLocation`; the query arguments from B2 and B3.
- Produces: entries carrying `tier`, ordered near-first, including fresh-rail arrivals; no empty-grid flash on a location or radius change.

- [ ] **Step 1: Resolve the origin**

```ts
    // The selected suburb's centroid. Resolved once per suburb from the dataset
    // locationService already caches, then sent as two numbers — the server
    // measures every ad itself.
    const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(null);
    useEffect(() => {
        let cancelled = false;
        if (!selectedLocation) { setOrigin(null); return; }
        void fetchLocations().then((all) => {
            if (cancelled) return;
            const match = all.find((loc) => formatLocation(loc) === selectedLocation);
            setOrigin(match ? { lat: match.lat, lng: match.long } : null);
        });
        return () => { cancelled = true; };
    }, [selectedLocation]);

    const proximityArgs = useMemo(
        () => (origin && radiusKm !== ANYWHERE
            ? { originLat: origin.lat, originLng: origin.lng, radiusKm }
            : {}),
        [origin, radiusKm]
    );
```

- [ ] **Step 2: Don't fire the unbucketed query first**

`origin` resolves asynchronously, so a naive wiring fires once without it and again with it — two feed wipes per suburb change. Hold the query at `"skip"` while a `selectedLocation` is set but `origin` is still null.

- [ ] **Step 3: Seed the new cache key**

The cache key (`MarketplaceContext.tsx:110`) includes location and now radius, so changing either mounts an empty accumulator and the grid flashes 12 skeletons. Seed the new key with the previous entries and render them dimmed until the first page lands. Keep scroll position.

- [ ] **Step 4: Tier the fresh rail**

`mergeAheadOfQuery` (`:230`) prepends arrivals to the **front** of the array. Under tiering that splices a far ad above the near block. Compute each arrival's tier client-side with the same `distanceKm`, then insert at the front **of its own tier**.

This is the one place the maths runs twice, server and client. Import `convex/lib/geo.ts` directly from the client rather than copying it — it is dependency-free precisely so this is possible.

- [ ] **Step 5: Verify**

Manual: change suburb and radius repeatedly — the grid never empties, scroll never jumps, and a new arrival in a distant suburb appears below the divider, not above it.

---

### Task B6: The divider, the empty state, and an honest header

**Files:** Create `src/features/ads/NearbyBoundary.tsx`; modify `src/features/ads/AdsGrid.tsx:113-170`, `:415-428`, `src/features/ads/PostAd.tsx`; test `src/features/ads/AdsGrid.test.tsx`, `e2e/`

**Interfaces:**
- Consumes: `tier` on each entry; `nextRadius`; `useMotionPrefs()`.
- Produces: `<NearbyBoundary suburb radiusKm hasNearResults onWiden categoryName? />`.

- [ ] **Step 1: Write the failing test**

Append to `src/features/ads/AdsGrid.test.tsx`:

```tsx
describe("nearby boundary", () => {
  test("renders once, before the first far ad", () => {
    render(<AdsGrid
      entries={[
        makeAdEntry({ id: "a", title: "Near", tier: "near" }),
        makeAdEntry({ id: "b", title: "Far", tier: "far" }),
        makeAdEntry({ id: "c", title: "Further", tier: "far" }),
      ]}
      selectedSuburb="Bondi, NSW 2026" radiusKm={10} />);

    expect(screen.getAllByTestId("nearby-boundary")).toHaveLength(1);
    expect(screen.getByText("Further from Bondi")).toBeInTheDocument();
    expect(screen.getByText(/You've seen everything within 10 km/)).toBeInTheDocument();
  });

  test("offers to widen to the next radius", () => {
    render(<AdsGrid
      entries={[makeAdEntry({ id: "a", title: "Near", tier: "near" }), makeAdEntry({ id: "b", title: "Far", tier: "far" })]}
      selectedSuburb="Bondi, NSW 2026" radiusKm={10} />);

    expect(screen.getByRole("button", { name: /Widen to 25 km/ })).toBeInTheDocument();
  });

  test("with nothing nearby it leads with the banner, not a bare divider", () => {
    render(<AdsGrid
      entries={[makeAdEntry({ id: "b", title: "Far", tier: "far" })]}
      selectedSuburb="Bondi, NSW 2026" radiusKm={10} />);

    expect(screen.getByText(/Nothing in Bondi right now/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Build `NearbyBoundary`**

Two modes, one component.

- **Divider** (near results exist): kicker `Further from {suburb}`, then `You've seen everything within {radius} km.` — note this says what was *shown*, not what *exists*, because `maximumRowsRead` can end the near phase early. Then a `Widen to {next} km` button when `nextRadius` returns one.
- **Banner** (no near results): `Nothing in {suburb} right now` + `Showing the newest flyers from further out.` Two actions: widen, and clear the location. When a category is active, name it — *"No furniture in Bondi right now"* — otherwise the user blames the location for a category-shaped absence.

- [ ] **Step 3: Render it in the grid**

Insert at the first entry whose `tier === "far"`. Exactly one, whatever the pagination does. Announce the boundary in the existing live region.

- [ ] **Step 4: Far-tier distance on the card**

Far cards read `Parramatta · ~25 km` using `roundedBand`. Near cards are unchanged — inside the radius the number would just parrot the filter back, the exact uselessness observed on eBay.

- [ ] **Step 5: Honest header count**

`AdsGrid.tsx:415-428` prints a total. Under tiering, print the near count and label it: `12 within 10 km` — never a bare total that mixes tiers.

- [ ] **Step 6: Seller reach line in `PostAd`**

One line under the location field: *"Buyers within 10 km see this first. Everyone else sees it further down."* Sets the expectation Boost is later sold against.

- [ ] **Step 7: Verify**

Run: `npx vitest run src/features/ads/AdsGrid.test.tsx && npm run test:visual`

---

### Task B7: Verify, flag on, write back

- [ ] **Step 1: Full validation**

Run: `npm run lint`
Expected: PASS through all five stages.

- [ ] **Step 2: Whole suite**

Run: `npx vitest run`
Expected: PASS. Watch `convex/feed.test.ts`, `convex/ads.test.ts`, `convex/boost.test.ts` — every flag-off path must match end-of-Phase-A.

- [ ] **Step 3: Manual pass with the flag OFF**

Run: `npm run dev` (from the worktree, `.env.local` copied in)

Confirm nothing changed since Phase A: feed order, composites present in feed **and category feeds and search**, counts as before. **This is the safety property — verify it before turning the flag on.**

- [ ] **Step 4: Turn the flag on and walk it**

```bash
npx convex run featureFlags:setFlag '{"key": "proximityFeed", "enabled": true}'
```

At 360px:
1. No suburb set → no divider, feed unchanged, pill reads `Anywhere`.
2. Pick a suburb → **panel stays open**, chips visible, 10 km selected, every chip ≥44px.
3. "Show flyers" closes the panel, focus returns to the pill, pill reads `Bondi · 10 km`.
4. Feed shows near ads, then the divider, then the rest. **The grid never flashes skeletons.**
5. Tap "Widen to 25 km" → more ads move above the divider, no full wipe.
6. Suburb with nothing nearby → banner at the top, not a bare divider.
7. Category active + nothing nearby → copy names the category.
8. Search with a suburb set → near matches first, **newest first within them**, and local results are not starved by national ones.
9. **A local bundle and a local Moving Sale appear above the divider** — same as any ad. A distant one appears below.
10. Post an ad in a distant suburb, return home → it appears **below** the divider.
11. Boost a distant ad → it rises within its own section, never above the divider.
12. Far cards show `Parramatta · ~25 km`; near cards are unchanged.
13. Wait 60s on the feed → **the list does not reshuffle under you**.
14. Clear the location → radius resets, divider gone.

- [ ] **Step 5: Guardian pass**

Run the `product-guardian` agent over the full diff. The only expected finding is the accepted exception already recorded in `PRODUCT-RULES.md` (rule 5, behind the flag).

- [ ] **Step 6: Update the Boost decision record**

`ResearchLab/ideas/boost-monetisation.md` is status `Decided` with the rule "one shared sort key… no special cases in the query". Tiering is a filter phase, so the sort key rule holds — but Boost's *pitch* changes and that must be recorded deliberately, not left as a silent contradiction. Note: a boost re-stamps `bumpedAt` and rule 2 lifts it within each tier it appears in; with `proximityFeed` on, the seller-facing promise becomes **"your ad becomes new again — for buyers near you first"**. Composite boosts need no special case now that composites tier like any ad.

- [ ] **Step 7: Update the agent context**

In `.agent/gatheredContext/infrastructure/database.md`, add:

- **"Composites derive from members"** — the denormalised `categoryIds` / `searchText` / `latitude` / `longitude` on `saleEvents` and `saleBundles`, the refresh sites, and why denormalisation rather than query-time derivation (a search index needs its text at index time). **Name the staleness risk explicitly**: any new mutation that changes membership or a member's location/category/title must call `refreshCompositeDerived`.
- **"Proximity-ranked feed"** — the client sends origin + radius; two tiers with a phase-prefixed cursor; why the database cannot sort by distance (distance is a function of the viewer, so it is not a row property and cannot be indexed); why `tier` is per-entry rather than a page index (the fresh rail); the two-pass search and the recall trap it avoids.

Fix the two stale entries found during research: line ~159 lists a `by_location_category` search index that does not exist, and lines ~221-231 describe the search index as `search_title` queried with `.collect()` when it is `search_ads` with `.take(50)`.

Bump `Last Updated`.

- [ ] **Step 8: Update the research record**

In `ResearchLab/ideas/proximity-ranked-feed.md`, set `Status: Shipped (behind proximityFeed)`. Log: the radius control made this tractable — tier membership is a comparison against a number, where the blocker was that per-viewer distance can't be indexed. Record that composites turned out not to need geocoding infrastructure at all, only derivation from members. Record that three product/UX reviews cut it from five buckets to two, and that the empty-area banner, not the divider, is the common case at low inventory.

- [ ] **Step 9: Commit**

```bash
git add .agent/gatheredContext/infrastructure/database.md ResearchLab/ideas/proximity-ranked-feed.md ResearchLab/ideas/boost-monetisation.md
git commit -m "docs(feed): record composite derivation, proximity tiering, and stale-index fixes"
```

---

## Deferred

- **Delete the `proximityFeed` flag.** A temporary rollout lever, not a permanent setting. While it is off, the hard location filter stays live and rule 5 stays violated — accepted knowingly (see the "Accepted exceptions" table in `.agent/PRODUCT-RULES.md`), on the condition the flag goes away. Once verified in prod, remove the flag and the `!origin` branches with it. Don't let new code start depending on it existing.
- **Fuzzy search.** `ResearchLab/ideas/fuzzy-search.md` — "bike" should find "bicycle". Independent of this plan and composes cleanly with it: it changes *which* rows the search index returns, and Task A4 already fixed *how they're ordered*. Do it next; it is ~2 days and needs no migration.
- **Grid-cell spatial index.** Researched and rejected: helps only the near tier, cannot cover an annulus or a complement, and doesn't fix the sparse-area worst case (`maximumRowsRead` does). Revisit only if a near-tier page consistently reads more than a few thousand documents — and pick the encoding with real data in hand (H3 and S2 have far better resolution ladders than geohash for 5–50 km).
- **Multi-suburb composites.** A composite takes its first coordinated member's position. If bundles ever span suburbs, this needs a real answer — a centroid is not it (the average of two suburbs is a point in neither).
- **Saved-search alerts** ("tell me when something lists in Bondi"). The highest-value thing on the empty-area surface — it converts absent supply into a return visit. `@convex-dev/resend` is already registered. Belongs with the wanted-ads work.
- **Sub-5 km distance precision.** Off the table — trilateration risk.
