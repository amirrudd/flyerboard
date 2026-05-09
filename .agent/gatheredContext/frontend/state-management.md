---
trigger: always_on
description: State management and data flow
---

# State Management

**Last Updated**: 2026-05-09

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

### ⚠️ Known stale-cache risk (2026-05-09 audit, F5 — deferred)
The cache has **no TTL and no automatic invalidation**.
- `initialLoadTimestamp` is frozen at provider mount (`MarketplaceContext.tsx:71`) so `usePaginatedQuery`'s `maxCreationTime` filter never advances within a session — manual refresh of the page is the only way to see ads created after mount.
- Switching filters reads cached results immediately (`useEffect` on `cacheKey`), even if the cached entry is stale relative to the current backend state.

**Why kept this way:** Prevents flicker between filter switches and amortizes the on-mount load. Acceptable trade-off at current marketplace size; revisit when ad churn is high enough that "needs page refresh to see new ads" becomes user-visible.

**How to apply if you touch this code:** Don't add an aggressive TTL without a design discussion — it'll undo the anti-flicker benefit. The right fix is probably (a) refresh-on-focus + (b) invalidate-on-mutate (we already have `forceRefresh: true` from POST/edit/delete via `navigate('/', { state: { forceRefresh: true } })` — extend that pattern). Don't ship a "refresh every N seconds" timer.

## Persistence
- **Cookies**: selectedLocation is saved to cookies for persistence across sessions.
