import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

import { paginationOptsValidator } from "convex/server";

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
