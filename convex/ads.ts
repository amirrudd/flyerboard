import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

import { paginationOptsValidator } from "convex/server";

/**
 * Fetch paginated ads with optional filtering by category, search term, and location
 * 
 * Supports both search-based queries (using full-text search on title) and standard
 * queries (using indexes). Search queries return top 50 results without cursor pagination.
 * Standard queries support cursor-based pagination. Only returns active, non-deleted ads.
 * 
 * @param args.categoryId - Filter by specific category (optional)
 * @param args.search - Search term for title search (optional, returns top 50 results)
 * @param args.location - Filter by location string (optional, applied in-memory)
 * @param args.paginationOpts - Pagination cursor and page size
 * @param args.maxCreationTime - Maximum creation timestamp for pagination (optional)
 * @returns Paginated result with ads array, continuation cursor, and isDone flag
 * 
 * @example
 * ```typescript
 * // Get first page of all ads
 * const result = await ctx.runQuery(api.ads.getAds, {
 *   paginationOpts: { numItems: 20, cursor: null }
 * });
 * 
 * // Search for "laptop" in Electronics category
 * const laptops = await ctx.runQuery(api.ads.getAds, {
 *   categoryId: electronicsId,
 *   search: "laptop",
 *   paginationOpts: { numItems: 20, cursor: null }
 * });
 * 
 * // Get ads in Sydney
 * const sydneyAds = await ctx.runQuery(api.ads.getAds, {
 *   location: "Sydney",
 *   paginationOpts: { numItems: 20, cursor: null }
 * });
 * ```
 */
export const getAds = query({
  args: {
    categoryId: v.optional(v.id("categories")),
    search: v.optional(v.string()),
    location: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
    maxCreationTime: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (args.search) {
      // Search queries don't support pagination in the same way, return top results
      const ads = await ctx.db
        .query("ads")
        .withSearchIndex("search_ads", (q) => {
          let searchQuery = q.search("title", args.search!);

          if (args.categoryId) {
            searchQuery = searchQuery.eq("categoryId", args.categoryId);
          }
          if (args.location) {
            searchQuery = searchQuery.eq("location", args.location);
          }

          // Filter out deleted and inactive ads
          searchQuery = searchQuery.eq("isActive", true);

          return searchQuery;
        })
        .filter((q) => q.neq(q.field("isDeleted"), true))
        .take(50); // Limit search results since we can't easily paginate

      return {
        page: ads,
        isDone: true,
        continueCursor: "",
      };
    } else {
      let q = ctx.db
        .query("ads")
        .withIndex("by_creation_time", (q) => q.lte("_creationTime", args.maxCreationTime || Date.now()))
        .order("desc");

      if (args.categoryId) {
        q = ctx.db
          .query("ads")
          .withIndex("by_category", (q) => q.eq("categoryId", args.categoryId!))
          .order("desc");
      }

      const paginatedResult = await q
        .filter((q) =>
          q.and(
            q.eq(q.field("isActive"), true),
            q.neq(q.field("isDeleted"), true),
            args.maxCreationTime && args.categoryId
              ? q.lte(q.field("_creationTime"), args.maxCreationTime)
              : true
          )
        )
        .paginate(args.paginationOpts);

      // Apply location filter in memory if specified (since we can't easily index everything)
      // Note: This is imperfect for pagination if many items are filtered out, 
      // but sufficient for this scale. Ideally we'd have a composite index.
      if (args.location) {
        paginatedResult.page = paginatedResult.page.filter(ad => ad.location === args.location);
      }

      return paginatedResult;
    }
  },
});

/**
 * Get a single ad by its ID
 * 
 * Returns null if the ad doesn't exist or has been soft-deleted.
 * This is a public query that doesn't require authentication.
 * 
 * @param args.adId - The ID of the ad to retrieve
 * @returns The ad document or null if not found/deleted
 * 
 * @example
 * ```typescript
 * const ad = await ctx.runQuery(api.ads.getAdById, {
 *   adId: adId
 * });
 * 
 * if (!ad) {
 *   console.log("Ad not found or deleted");
 * }
 * ```
 */
export const getAdById = query({
  args: { adId: v.id("ads") },
  handler: async (ctx, args) => {
    const ad = await ctx.db.get(args.adId);

    // Return null if ad is deleted or doesn't exist
    if (!ad || ad.isDeleted) {
      return null;
    }

    return ad;
  },
});

/**
 * Increment the view count for an ad
 * 
 * This mutation is called when a user views an ad detail page.
 * It increments the views counter by 1. Requires the ad to exist
 * and not be deleted.
 * 
 * @param args.adId - The ID of the ad to increment views for
 * @returns Success object with success: true
 * @throws Error if ad not found or deleted
 * 
 * @example
 * ```typescript
 * await ctx.runMutation(api.ads.incrementViews, {
 *   adId: adId
 * });
 * ```
 */
export const incrementViews = mutation({
  args: { adId: v.id("ads") },
  handler: async (ctx, args) => {
    const ad = await ctx.db.get(args.adId);
    if (!ad || ad.isDeleted) {
      throw new Error("Ad not found");
    }

    await ctx.db.patch(args.adId, {
      views: ad.views + 1,
    });

    return { success: true };
  },
});

/**
 * Fetch ads created after a specific timestamp (for smart refresh)
 * 
 * Used to fetch new ads that were created since the last page load,
 * enabling a "smart refresh" feature that shows only new content.
 * Supports the same filtering options as getAds but returns an array
 * instead of paginated results.
 * 
 * @param args.categoryId - Filter by specific category (optional)
 * @param args.search - Search term for title search (optional)
 * @param args.location - Filter by location string (optional)
 * @param args.sinceTimestamp - Fetch ads created after this timestamp
 * @param args.limit - Maximum number of ads to return (default: 50)
 * @returns Array of ads created after the timestamp
 * 
 * @example
 * ```typescript
 * // Get ads created in the last 5 minutes
 * const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
 * const newAds = await ctx.runQuery(api.ads.getLatestAds, {
 *   sinceTimestamp: fiveMinutesAgo,
 *   limit: 20
 * });
 * 
 * // Get new ads in a specific category
 * const newCategoryAds = await ctx.runQuery(api.ads.getLatestAds, {
 *   categoryId: categoryId,
 *   sinceTimestamp: lastCheckTimestamp
 * });
 * ```
 */
export const getLatestAds = query({
  args: {
    categoryId: v.optional(v.id("categories")),
    search: v.optional(v.string()),
    location: v.optional(v.string()),
    sinceTimestamp: v.number(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;

    if (args.search) {
      // For search queries, fetch all matching results created after timestamp
      const ads = await ctx.db
        .query("ads")
        .withSearchIndex("search_ads", (q) => {
          let searchQuery = q.search("title", args.search!);

          if (args.categoryId) {
            searchQuery = searchQuery.eq("categoryId", args.categoryId);
          }
          if (args.location) {
            searchQuery = searchQuery.eq("location", args.location);
          }

          // Filter out deleted and inactive ads
          searchQuery = searchQuery.eq("isActive", true);

          return searchQuery;
        })
        .filter((q) =>
          q.and(
            q.neq(q.field("isDeleted"), true),
            q.gt(q.field("_creationTime"), args.sinceTimestamp)
          )
        )
        .take(limit);

      return ads;
    } else {
      // For non-search queries, use creation time index
      let q = ctx.db
        .query("ads")
        .withIndex("by_creation_time", (q) => q.gt("_creationTime", args.sinceTimestamp))
        .order("desc");

      if (args.categoryId) {
        q = ctx.db
          .query("ads")
          .withIndex("by_category", (q) => q.eq("categoryId", args.categoryId!))
          .order("desc");
      }

      const ads = await q
        .filter((q) =>
          q.and(
            q.eq(q.field("isActive"), true),
            q.neq(q.field("isDeleted"), true),
            args.categoryId
              ? q.gt(q.field("_creationTime"), args.sinceTimestamp)
              : true
          )
        )
        .take(limit);

      // Apply location filter in memory if specified
      if (args.location) {
        return ads.filter(ad => ad.location === args.location);
      }


      return ads;
    }
  },
});
