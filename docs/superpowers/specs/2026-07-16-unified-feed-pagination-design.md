# Unified Feed Pagination — Design

- **Date:** 2026-07-16
- **Status:** Approved (Amir, 2026-07-16)
- **Approach:** Option B — single merged paginated query via `convex-helpers` `mergedStream`
- **Companion decisions:** `ResearchLab/ideas/boost-pins-monetisation.md` (boost semantics that fixed the shared sort key)

## Problem

The home feed is assembled from three independent Convex queries: paginated ads
(`ads.getAds`), all active bundle cards (`bundles.getActiveBundleFeedCards`), and all
active sale cards (`saleEvents.getActiveSales`) — the latter two each gated behind their
own `useFeatureFlag` query. Consequences:

1. **Layout shift on load** — the composite-card queries resolve after the ads paint and
   pop into the date-sorted grid (patched 2026-07-16 with `auxCardsPending`, but the
   patch treats the symptom).
2. **Pagination is wrong by construction** — composites are fetched in full and injected
   into whatever ads happen to be loaded; the "first N feed items" never truly includes
   all types by sort order, and every active composite is hydrated on every load
   (N+1 `ctx.db.get` per bundle member).
3. **Three loading states, two feature-flag round-trips** on the client for one feed.

Requirement: one paginated feed where standard ads, Bundle cards, and Moving Sale cards
interleave on a single sort key from the first page.

## Decision context — why `bumpedAt` everywhere

Per the boost decision (card-only semantics, no cascade): every feed card type carries
its own independent `bumpedAt`. Boosting any card patches only that card's `bumpedAt`.
Member ads are permanently boost-ineligible. This gives the unified feed one mutable
sort key with no special cases.

## Rejected alternatives

- **A. Denormalized `feedCards` table** (hand-maintained materialized view): correct at
  any scale, but adds a table, a backfill, and a dual-write to every lifecycle mutation.
  Documented upgrade path if composite volume ever makes per-page streams expensive;
  the migration from B is additive.
- **C. Status quo + window clamping:** keeps three queries/loading states; doesn't meet
  the first-N requirement at page boundaries.

Convex has no SQL views/materialized views; `mergedStream` (already installed,
`convex-helpers` ^0.1.116) is the idiomatic equivalent for a paginatable multi-table
union ordered by a shared field.

## Design

### 1. Schema & migration

- `saleBundles`: add `bumpedAt: v.number()` and optional `boostCount`. New index
  `by_status_and_bumped_at` on `["status", "bumpedAt"]`. Backfill migration: normalise
  legacy rows (`status` missing → `"active"`), set `bumpedAt = _creationTime`.
- `saleEvents`: add `bumpedAt` and optional `boostCount`. New index
  `by_status_and_bumped_at`. Backfill `bumpedAt = createdAt`. For NEW sales, `bumpedAt`
  is stamped at **publish** (draft → active transition), not draft creation — a sale
  must not feed-rank by when drafting started.
- `ads`: unchanged (already has `bumpedAt` + `by_bumped_at`).
- One migration in `convex/migrations.ts`; run against dev, then prod
  (`resilient-pheasant-112`) per the deployment rules.
- Creation writes: standalone bundle creation sets `bumpedAt = Date.now()`; sale publish
  mutation sets it on transition to `active`.

### 2. Unified query — `convex/feed.ts` → `getFeed`

Public paginated query replacing the feed's three data sources.

- **Args:** `{ paginationOpts, categoryId?: Id<"categories">, maxSortTime?: number }` —
  identical freeze-at-mount contract to today's `getAds` (`MarketplaceContext` freezes
  `maxSortTime` at mount; fresh arrivals accumulate separately).
- **Uncategorised branch:** `mergedStream` ordered by `["bumpedAt"]` desc over:
  - ads: `stream(...).query("ads").withIndex("by_bumped_at", q => q.lte("bumpedAt", maxSortTime))`,
    filtered `!isDeleted && isActive` (same predicate set as today's `getAds`);
  - standalone bundles: `by_status_and_bumped_at` eq `"active"`, `filterWith`
    `!saleEventId && !isDeleted` (standalone-only; sale-suggestion bundles never feed);
  - sales: `by_status_and_bumped_at` eq `"active"`.
- **Feature flags server-side:** the query reads `bundleListing` / `movingSaleMode`
  flags from the `featureFlags` table; a disabled flag simply excludes that stream. The
  client no longer queries flags for the feed.
- **Category branch and search:** ads-only, logic unchanged from `getAds` /
  `searchAds`. Composites do not appear on category feeds or in search (existing
  documented decision: "members look like plain listings in search").
- **Return shape:** standard pagination result whose `page` is a discriminated union:
  `{ kind: "ad", ad } | { kind: "bundle", card } | { kind: "sale", card }` where `card`
  matches the existing `BundleFeedCard` / `SaleFeedCard` shapes (hydrated per page —
  covers, savings, itemCount). Hydration cost drops from all-actives-every-load to
  ~0–2 composites per page.
- Bundle card hydration must preserve existing render-time rules (sold/deleted member
  filtering; despawn below 2 live members → such a bundle is excluded from the page).

### 3. Frontend

- `MarketplaceContext`: swap `usePaginatedQuery(api.ads.getAds)` →
  `api.feed.getFeed`. `maxSortTime` freeze, `freshAdsRef`, `knownAdIds` dedupe, and the
  60s visibility refresh keep their current shape; dedupe keys become
  `kind + id`.
- `HomePage`: DELETE `activeSales`, `bundleCards`, both `useFeatureFlag` feed calls,
  `auxCardsPending` (the 2026-07-16 patch — obsolete), and the `bundleCards`/
  `saleCards`/`onBundleClick`/`onSaleClick` prop plumbing stays but is fed from the
  unified entries. The member-cap filter (`sale:` ≤3, `bundle:` ≤2 per composite) now
  runs over the unified page's ad entries — logic identical.
- `AdsGrid`: DELETE the three-way merge `useMemo` — the server page is already
  interleaved; map it straight to `FeedEntry`. Skeleton gate remains
  `isLoading || feed === undefined`, now truthful because there is exactly one query.
- `bundles.getActiveBundleFeedCards` / `saleEvents.getActiveSales`: delete if the home
  feed was their only caller; keep any other call sites (dashboard, public pages)
  untouched.

### 4. Known edges (decided)

- **Live arrivals stay ads-only in v1**: `getLatestAds` is unchanged; a bundle/sale
  published while a feed is open won't appear until refresh. More conservative than
  today's pop-in, acceptable because composites are rare events.
  `ponytail:` extend fresh-arrivals to composites only if reported.
- **Mid-session boost visibility** follows the boost plan's Phase 2 refresh semantics;
  nothing new here.
- **Page-size variance**: merged pages are exact-N items but ad/composite mix varies;
  the member-cap filter can shrink a rendered page by a card or two — same as today.

### 5. Tests

- **New `convex/feed.test.ts`** (convex-test): interleaving order across the three
  types (strictly `bumpedAt` desc across kinds); page-boundary correctness (a composite
  whose `bumpedAt` falls between two pages appears exactly once, on the right page);
  flag-off excludes the stream; category branch returns ads only; deleted/inactive/
  partial-status composites excluded; bundle with <2 live members excluded;
  `maxSortTime` respected across all three streams.
- **Update `AdsGrid.test.tsx`**: remove merge-memo cases; assert it renders a
  pre-interleaved server page verbatim.
- **Update/remove `HomePage`-adjacent tests** touching `auxCardsPending`, flag gating,
  and the two deleted queries.
- **Migration test**: backfill idempotency (re-run safe), legacy `status`-missing rows
  normalised.
- **E2E**: existing Playwright visual suite must pass; re-run the rAF-poller check
  (documented in `.claude/skills/verify/SKILL.md`) — first painted grid must contain
  the composite cards, zero post-paint insertions.

### 6. Docs & context updates (same PR)

- `.agent/gatheredContext/features/bundles.md` — replace the 2026-07-16 pop-in gotcha
  with the unified-feed pattern (the gotcha's fix is deleted by this design); update
  the Frontend section's query wiring description.
- `.agent/gatheredContext/features/moving-sale.md` — same treatment for sale cards.
- `.agent/gatheredContext/infrastructure/database.md` — new tables' `bumpedAt` fields,
  indexes, and the `mergedStream` pattern with a short code example (this is the
  project's first use; future multi-table feeds should follow it).
- `.agent/gatheredContext/frontend/state-management.md` — MarketplaceContext now owns
  one feed query; document the discriminated-union page shape.
- `docs/architecture/design-decisions.md` — entry: "Unified feed via mergedStream
  instead of a denormalized feed table — why, and the trigger for upgrading to one".
- `.agent/plans/boost-to-top-feature.md` — amendment note: boost surface extends to
  composite cards; eligibility/cooldown unchanged for ads; pins model in
  `ResearchLab/ideas/boost-pins-monetisation.md`.
- `CLAUDE.md` — update the Architecture bullet describing the feed queries.

## Out of scope

- Boost implementation itself (pins, weekly caps, interest capture) — separate plan.
- Composites in category/search feeds.
- Fresh-arrivals for composites.
- The `feedCards` table (Option A) — documented trigger: composite volume or stream
  cost makes per-page merge measurably slow.

## Success criteria

1. First rendered feed page contains all card types interleaved strictly by `bumpedAt`.
2. Exactly one Convex query drives the home feed; zero post-skeleton insertions
   (rAF-poller evidence).
3. `npm run lint` + full Vitest + Playwright visual suite green.
4. Net client LOC negative (three queries + merge memo + `auxCardsPending` deleted).
