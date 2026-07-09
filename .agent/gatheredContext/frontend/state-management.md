---
trigger: always_on
description: State management and data flow
---

# State Management

**Last Updated**: 2026-07-09

## Global State (MarketplaceContext)
- **Filters**: selectedCategory, searchQuery, selectedLocation.
- **UI State**: sidebarCollapsed.
- **Data**: categories (fetched once), ads (paginated).

## Data Fetching (Convex)
- **Hooks**: useQuery (subscriptions), useMutation (changes), usePaginatedQuery (infinite scroll).
- **Real-time**: UI updates automatically when backend data changes.

## Caching Strategy
- **Client-side Cache**: adsCache (Map) in context, typed `Map<string, Doc<"ads">[]>` (was `any[]` until 2026-05-09).
- **Key**: Combination of filters (category_search_location).
- **Behavior**: Serves cached ads immediately while fetching fresh data to prevent UI flicker.

### Frozen pagination + fresh-ads merge (updated 2026-07-09 for Boost)
The cache has **no TTL and no automatic invalidation**, and `initialLoadTimestamp` is frozen at provider mount (`maxSortTime` on `usePaginatedQuery` — renamed from `maxCreationTime` when the feed sort key became `bumpedAt`) — so the paginated query can NEVER return ads whose sort key moved past mount time. That uniformly covers **brand-new ads AND boosted ads** (a boost re-stamps `bumpedAt`, pushing the ad above the frozen bound, which *ejects* it from every open session's paginated results). Both reach the feed only via `refreshAds` (`getLatestAds` since a watermark), triggered by `navigate('/', { state: { forceRefresh: true } })` after post/edit/delete/**boost**, by a throttled visibilitychange handler, and (since Boost, Jul 2026) by a deliberate **60 s interval tick while the tab is visible** — without the tick, a same-tab viewer would lose a boosted ad permanently for the session. A boosted ad may therefore blink out of an open feed for **up to ~60 s** between ejection and the next tick — accepted v1 behavior; don't "fix" it with a faster timer without a design discussion.

**Prod bug fixed 2026-07-06 (drop-merged-ads):** `refreshAds` used to merge new ads into the RAW paginated results (`ads`), not the displayed list — so posting flyer #2 rebuilt the list without flyer #1, and since the `sinceTimestamp` watermark had already advanced past #1's creation time, no later refresh could ever bring it back (only a hard reload). The cache-sync `useEffect` on `[ads, cacheKey]` had the same clobber. Fix pattern (in `MarketplaceContext.tsx`):
- `freshAdsRef: Map<cacheKey, Doc<"ads">[]>` accumulates every ad merged via `refreshAds`. Both rebuild sites (`refreshAds` and the cache-sync effect) prepend `fresh` and dedupe against it — fresh ads are permanently invisible to the frozen query, so they must be re-merged on EVERY rebuild, forever.
- Refresh watermarks are per-cacheKey (`lastRefreshTimestamps: Map`), not global — a refresh under one filter must not advance the watermark past ads another filter's view hasn't merged yet.
- Ordering doesn't matter much: `AdsGrid` re-sorts the merged feed (ads + sale cards + bundle cards) by sort key (`bumpedAt` for ads since Boost; creation time for sale/bundle cards).

**Boost extension (Jul 2026) — `src/context/freshAdsMerge.ts`:** the merge logic was extracted into a pure, unit-tested module (`freshAdsMerge.test.ts`) precisely because `_id`-only dedupe would have silently dropped boosted ads (the 8cf9b00 bug class, second incarnation). Rules:
- `classifyLatestAds` splits `getLatestAds` results into **brand-new** (unknown `_id` → added to fresh rail AND `newAdIds` → gets the "New" badge) vs **boosted replacement** (known `_id` but returned `bumpedAt` newer than the held copy → replaces the stale copy in `freshAdsRef`, is dropped from paginated results by `_id` at rebuild, and deliberately gets NO "New" badge — the one-time `boostPinDrop` ring pulse is its arrival cue instead, keyed `${_id}:${bumpedAt}` so re-renders don't replay it but a later boost does).
- **Watermark rule (`nextWatermark`):** advance `sinceTimestamp` to `max(bumpedAt of merged results)`, NEVER `Date.now()` — a wall-clock watermark can skip a boost that races a re-emitting paginated query, making it unrecoverable for the session.
- Never dedupe fresh-rail entries by `_id` alone; always compare `bumpedAt`.

**Why the freeze is kept:** prevents flicker between filter switches and amortizes the on-mount load. The only sanctioned timer is the Boost 60 s visible-tab tick above — don't add an aggressive TTL or a faster refresh timer without a design discussion. Known remaining gap: fresh ads that are later sold/edited/deleted linger stale in `freshAdsRef` until page reload (same staleness class as the rest of the cache; slightly more exposed now that boosted ads sit at feed top).

## Persistence
- **Cookies**: selectedLocation is saved to cookies for persistence across sessions.
