---
trigger: always_on
description: State management and data flow
---

# State Management

## Global State (MarketplaceContext)
- **Filters**: selectedCategory, searchQuery, selectedLocation.
- **UI State**: sidebarCollapsed.
- **Data**: categories (fetched once), ds (paginated).

## Data Fetching (Convex)
- **Hooks**: useQuery (subscriptions), useMutation (changes), usePaginatedQuery (infinite scroll).
- **Real-time**: UI updates automatically when backend data changes.

## Caching Strategy
- **Client-side Cache**: dsCache (Map) in context.
- **Key**: Combination of filters (category_search_location).
- **Behavior**: Serves cached ads immediately while fetching fresh data to prevent UI flicker.

## Persistence
- **Cookies**: selectedLocation is saved to cookies for persistence across sessions.
