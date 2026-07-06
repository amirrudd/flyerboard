---
trigger: always_on
description: State management and data flow
---

# State Management

**Last Updated**: 2026-07-06

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

### Frozen pagination + fresh-ads merge (updated 2026-07-06)
The cache has **no TTL and no automatic invalidation**, and `initialLoadTimestamp` is frozen at provider mount (`maxCreationTime` on `usePaginatedQuery`) — so the paginated query can NEVER return ads created after mount. New ads reach the feed only via `refreshAds` (`getLatestAds` since a watermark), triggered by `navigate('/', { state: { forceRefresh: true } })` after post/edit/delete and by a throttled visibilitychange handler.

**Prod bug fixed 2026-07-06 (drop-merged-ads):** `refreshAds` used to merge new ads into the RAW paginated results (`ads`), not the displayed list — so posting flyer #2 rebuilt the list without flyer #1, and since the `sinceTimestamp` watermark had already advanced past #1's creation time, no later refresh could ever bring it back (only a hard reload). The cache-sync `useEffect` on `[ads, cacheKey]` had the same clobber. Fix pattern (in `MarketplaceContext.tsx`):
- `freshAdsRef: Map<cacheKey, Doc<"ads">[]>` accumulates every ad merged via `refreshAds`. Both rebuild sites (`refreshAds` and the cache-sync effect) prepend `fresh` and dedupe by `_id` — fresh ads are permanently invisible to the frozen query, so they must be re-merged on EVERY rebuild, forever.
- Refresh watermarks are per-cacheKey (`lastRefreshTimestamps: Map`), not global — a refresh under one filter must not advance the watermark past ads another filter's view hasn't merged yet.
- Ordering doesn't matter much: `AdsGrid` re-sorts the merged feed (ads + sale cards + bundle cards) by creation time.

**Why the freeze is kept:** prevents flicker between filter switches and amortizes the on-mount load. Don't add an aggressive TTL or a "refresh every N seconds" timer without a design discussion. Known remaining gap: fresh ads that are later sold/deleted linger in `freshAdsRef` until page reload (same staleness class as the rest of the cache).

## Persistence
- **Cookies**: selectedLocation is saved to cookies for persistence across sessions.
