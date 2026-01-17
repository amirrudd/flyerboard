# Database Patterns & Convex

**Last Updated**: 2026-01-17

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
  _creationTime: number;
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

### Soft Delete
**Pattern**: Mark as deleted instead of removing
```typescript
await ctx.db.patch(args.adId, {
  isDeleted: true,
  isActive: false,
});
```

**Rationale**:
- Allows restoration
- Preserves data integrity (foreign keys)
- Enables cleanup jobs later

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
