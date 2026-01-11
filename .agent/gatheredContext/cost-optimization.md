# Cost Optimization Patterns

**Last Updated**: 2026-01-12

## Overview

This document describes patterns and optimizations implemented to minimize Convex function calls and reduce operational costs.

## Query Optimization Patterns

### 1. Combined Queries

**Problem**: Multiple small queries create more function invocations.
**Solution**: Combine related queries into single calls.

#### Combined User + Stats Query
```typescript
// Instead of 2 queries:
const user = useQuery(api.descopeAuth.getCurrentUser);
const stats = useQuery(api.users.getUserStats);

// Use 1 combined query:
const userWithStats = useQuery(api.descopeAuth.getCurrentUserWithStats);
const user = userWithStats?.user;
const stats = userWithStats?.stats;
```

#### Combined AdDetail Context Query
```typescript
// Instead of 4 queries (ad, isSaved, existingChat, user):
const adContext = useQuery(api.adDetail.getAdWithContext, { adId });
const ad = adContext?.ad;
const isSaved = adContext?.isSaved ?? false;
const existingChat = adContext?.existingChat;
```

### 2. Lazy Loading with Skip

**Problem**: Loading all data on component mount wastes resources.
**Solution**: Use conditional `"skip"` based on active tab/state.

```typescript
// Only fetch when tab is active
const userAds = useQuery(
  api.posts.getUserAds,
  activeTab === "ads" ? {} : "skip"
);

const savedAds = useQuery(
  api.adDetail.getSavedAds,
  activeTab === "saved" ? {} : "skip"
);
```

**Note**: Convex's client-side cache ensures instant display when revisiting tabs.

### 3. On-Demand Refresh vs Subscriptions

**Problem**: Continuous subscriptions re-execute on every database change.
**Solution**: Use on-demand queries with throttling.

```typescript
// Instead of continuous subscription:
// const latestAds = useQuery(api.ads.getLatestAds, {...});

// Use on-demand refresh with throttle:
const convex = useConvex();
const THROTTLE_MS = 60000; // 60 seconds

const refreshAds = async (forceRefresh = false) => {
  if (!forceRefresh && Date.now() - lastRefresh < THROTTLE_MS) return;
  
  const latestAds = await convex.query(api.ads.getLatestAds, {...});
  // merge and update state
};
```

## Mutation Optimization Patterns

### 4. View Batching

**Problem**: Incrementing views on every page visit is expensive.
**Solution**: Batch views and flush periodically.

**Implementation**: `src/lib/viewTracker.ts`

```typescript
// Track view (deduped per session)
trackView(adId);

// Views auto-flush every 30 seconds or on tab hide
// Uses single batchIncrementViews mutation
```

**Backend**: `convex/adDetail.ts`
```typescript
export const batchIncrementViews = mutation({
  args: { adIds: v.array(v.id("ads")) },
  handler: async (ctx, args) => {
    for (const adId of args.adIds) {
      const ad = await ctx.db.get(adId);
      if (ad && !ad.isDeleted) {
        await ctx.db.patch(adId, { views: ad.views + 1 });
      }
    }
  },
});
```

## Key Files

| File | Optimization |
|------|-------------|
| `src/context/MarketplaceContext.tsx` | Throttled refresh, on-demand queries |
| `src/lib/viewTracker.ts` | View batching with session deduplication |
| `src/features/dashboard/UserDashboard.tsx` | Lazy tab loading, combined user+stats |
| `src/features/ads/AdDetail.tsx` | Combined context query, batched views |
| `convex/descopeAuth.ts` | `getCurrentUserWithStats` combined query |
| `convex/adDetail.ts` | `getAdWithContext`, `batchIncrementViews` |

## Cost Impact Summary

| Pattern | Before | After |
|---------|--------|-------|
| Ad refresh | Continuous subscription | On-demand (60s throttle) |
| View counting | 1 mutation per view | 1 mutation per 30s batch |
| AdDetail page | 4 queries | 2 queries |
| Dashboard load | 6+ queries | 2-3 queries |
| User + Stats | 2 queries | 1 query |

## Best Practices

1. **Combine related queries** when data is always fetched together
2. **Use "skip"** for data not currently visible
3. **Throttle refreshes** to prevent excessive polling
4. **Batch mutations** for high-frequency operations (views, analytics)
5. **Use forceRefresh** flag to bypass throttle when user action requires immediate update
