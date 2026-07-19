import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

import { paginationOptsValidator } from "convex/server";

/**
 * Full-text ad search (title), optionally narrowed by category and location.
 *
 * Search-only since the unified feed (Phase 3): browsing/pagination lives in
 * `feed.getFeed`; this survives for the home-feed search box and the
 * CommandPalette. Returns the top 50 matches in a single "page" (search
 * indexes don't cursor-paginate) — `paginationOpts` is accepted for
 * `usePaginatedQuery` compatibility but only shapes the response envelope.
 *
 * DEPLOY COMPAT (remove one release after the unified feed ships): `search` is
 * optional and `maxSortTime` is accepted because browser sessions opened before
 * the deploy still call the pre-unified-feed signature (Convex swaps functions
 * atomically; the stale bundle keeps calling until a refresh). Without the
 * legacy browse branch below, every open home-feed tab errors into its
 * ErrorBoundary at deploy time. New clients never hit the else-branch.
 *
 * @param args.search - Search term for title search (omitted only by stale clients)
 * @param args.categoryId - Filter by specific category (optional)
 * @param args.location - Filter by location string (optional, exact match)
 * @param args.paginationOpts - Pagination envelope (results are one page)
 * @returns Paginated-shaped result with ads array, isDone: true
 *
 * Excludes `isSold` ads (same as `isDeleted`) — a sold item, standalone or bundled,
 * shouldn't browse as available. Direct links (e.g. a seller's own dashboard) still
 * resolve via `getAdById`, which is unfiltered.
 */
export const getAds = query({
  args: {
    categoryId: v.optional(v.id("categories")),
    search: v.optional(v.string()),
    location: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
    // DEPLOY COMPAT: pre-unified-feed clients pass this. Only the legacy branch reads it.
    maxSortTime: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (!args.search) {
      // DEPLOY COMPAT — legacy browse branch for stale clients only (see doc above).
      let q = ctx.db
        .query("ads")
        .withIndex("by_bumped_at", (qq) => qq.lte("bumpedAt", args.maxSortTime ?? Date.now()))
        .order("desc");
      if (args.categoryId) {
        q = ctx.db
          .query("ads")
          .withIndex("by_category_and_bumped_at", (qq) =>
            qq.eq("categoryId", args.categoryId!).lte("bumpedAt", args.maxSortTime ?? Date.now())
          )
          .order("desc");
      }
      const paginatedResult = await q
        .filter((qq) =>
          qq.and(
            qq.eq(qq.field("isActive"), true),
            qq.neq(qq.field("isDeleted"), true),
            qq.neq(qq.field("isSold"), true)
          )
        )
        .paginate(args.paginationOpts);
      if (args.location) {
        paginatedResult.page = paginatedResult.page.filter((ad) => ad.location === args.location);
      }
      return paginatedResult;
    }

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
      .filter((q) => q.and(q.neq(q.field("isDeleted"), true), q.neq(q.field("isSold"), true)))
      .take(50); // Limit search results since we can't easily paginate

    return {
      page: ads,
      isDone: true,
      continueCursor: "",
    };
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
 *   console.log("Flyer not found or deleted");
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
      throw new Error("Flyer not found");
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
            q.neq(q.field("isSold"), true),
            q.gt(q.field("_creationTime"), args.sinceTimestamp)
          )
        )
        .take(limit);

      return ads;
    } else {
      // For non-search queries, order by the bumpedAt feed sort key (Phase 1B).
      // `sinceTimestamp` is a bumpedAt watermark: this surfaces both brand-new ads
      // AND ads boosted since the caller last refreshed.
      let q = ctx.db
        .query("ads")
        .withIndex("by_bumped_at", (q) => q.gt("bumpedAt", args.sinceTimestamp))
        .order("desc");

      if (args.categoryId) {
        q = ctx.db
          .query("ads")
          // Category branch also orders by bumpedAt (Phase 1B) via the composite
          // [categoryId, bumpedAt] index. The index supports .eq on the leading
          // categoryId AND a range on the trailing bumpedAt, so the lower bound
          // is pushed into the index range here (no post-filter needed).
          .withIndex("by_category_and_bumped_at", (q) =>
            q.eq("categoryId", args.categoryId!).gt("bumpedAt", args.sinceTimestamp)
          )
          .order("desc");
      }

      const ads = await q
        .filter((q) =>
          q.and(
            q.eq(q.field("isActive"), true),
            q.neq(q.field("isDeleted"), true),
            q.neq(q.field("isSold"), true)
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
