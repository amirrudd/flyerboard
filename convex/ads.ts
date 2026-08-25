import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

import { paginationOptsValidator } from "convex/server";
import {
  bundleIsLive,
  compositeMatchesFilters,
  hydrateEntries,
  saleIsLive,
  type FeedSourceEntry,
} from "./lib/cards";
import { isFlagEnabled } from "./featureFlags";

const SEARCH_LIMIT = 50;

/**
 * Ceiling on composite rows read per table. `search_composite`'s filterFields
 * are `status` only (`isDeleted` is a post-search `.filter()`, not a filter
 * field) — and neither `categoryIds` (an array;
 * Convex can't index array-contains) nor `location` is indexed, so both
 * narrowings are JS predicates that must run BELOW the cap, or out-of-category
 * rows eat the budget and a qualifying card disappears.
 *
 * ponytail: over-fetch instead of a new index. Both composite tables are orders
 * of magnitude smaller than `ads` (tens of rows, not tens of thousands), so
 * reading up to 500 of them is cheap. If either table ever grows past this,
 * denormalise a single `categoryId`/`location` filter field onto the row and
 * push the narrowing into the index instead.
 */
const COMPOSITE_LIMIT = 500;

/**
 * Read both composite tables behind their feature flags and tag the live,
 * in-filter rows. `buildBundles`/`buildSales` supply the per-table query
 * (search index vs `by_status_and_bumped_at`); everything else — flags,
 * concurrency, liveness, category/location narrowing — is the same either way.
 */
async function compositeHits(
  ctx: QueryCtx,
  args: { categoryId?: Doc<"ads">["categoryId"]; location?: string },
  buildBundles: () => Promise<Doc<"saleBundles">[]>,
  buildSales: () => Promise<Doc<"saleEvents">[]>
): Promise<FeedSourceEntry[]> {
  const [bundlesEnabled, salesEnabled] = await Promise.all([
    isFlagEnabled(ctx, "bundleListing"),
    isFlagEnabled(ctx, "movingSaleMode"),
  ]);

  const [bundles, sales] = await Promise.all([
    bundlesEnabled ? buildBundles() : [],
    salesEnabled ? buildSales() : [],
  ]);

  const now = Date.now();
  return [
    ...bundles
      .filter((b) => bundleIsLive(b) && compositeMatchesFilters(b, args))
      .map((doc) => ({ kind: "bundle" as const, doc })),
    ...sales
      .filter((s) => saleIsLive(s, now) && compositeMatchesFilters(s, args))
      .map((doc) => ({ kind: "sale" as const, doc })),
  ];
}

/**
 * Run the three search indexes (ads + both composite tables) concurrently and
 * return the raw hits.
 *
 * A composite matches when any MEMBER ad matches — that's what `searchText`
 * holds. Category and `location` narrow all three tables (rules 1 and 4,
 * `.agent/PRODUCT-RULES.md`): on `ads` as index filter fields, on composites as
 * post-search predicates over the derived `categoryIds`/`location`.
 *
 * `sinceTimestamp`, when given, is a `bumpedAt` lower bound pushed into every
 * query so the per-table cap keeps rows that are relevant AND fresh (a JS
 * filter after the cap loses a fresh row ranking below it).
 */
async function searchAllTypes(
  ctx: QueryCtx,
  args: {
    search: string;
    categoryId?: Doc<"ads">["categoryId"];
    location?: string;
    sinceTimestamp?: number;
    limit: number;
  }
): Promise<FeedSourceEntry[]> {
  const since = args.sinceTimestamp;
  const cap = COMPOSITE_LIMIT;
  const [ads, composites] = await Promise.all([
    ctx.db
      .query("ads")
      .withSearchIndex("search_ads", (q) => {
        let searchQuery = q.search("title", args.search);

        if (args.categoryId) {
          searchQuery = searchQuery.eq("categoryId", args.categoryId);
        }
        if (args.location) {
          searchQuery = searchQuery.eq("location", args.location);
        }

        return searchQuery.eq("isActive", true);
      })
      .filter((q) =>
        q.and(
          q.neq(q.field("isDeleted"), true),
          q.neq(q.field("isSold"), true),
          since === undefined ? true : q.gt(q.field("bumpedAt"), since)
        )
      )
      .take(args.limit),
    compositeHits(
      ctx,
      args,
      () =>
        ctx.db
          .query("saleBundles")
          .withSearchIndex("search_composite", (q) =>
            q.search("searchText", args.search).eq("status", "active")
          )
          .filter((q) =>
            q.and(
              q.neq(q.field("isDeleted"), true),
              since === undefined ? true : q.gt(q.field("bumpedAt"), since)
            )
          )
          .take(cap),
      () =>
        ctx.db
          .query("saleEvents")
          .withSearchIndex("search_composite", (q) =>
            q.search("searchText", args.search).eq("status", "active")
          )
          .filter((q) => (since === undefined ? true : q.gt(q.field("bumpedAt"), since)))
          .take(cap),
    ),
  ]);

  return [...ads.map((doc) => ({ kind: "ad" as const, doc })), ...composites];
}

/**
 * The browse counterpart of `searchAllTypes`: every composite bumped since the
 * watermark, ordered by `bumpedAt` desc via `by_status_and_bumped_at`;
 * `mergeAndHydrate` interleaves them with the ads (rule 2).
 */
async function latestComposites(
  ctx: QueryCtx,
  args: {
    categoryId?: Doc<"ads">["categoryId"];
    location?: string;
    sinceTimestamp: number;
    limit: number;
  }
): Promise<FeedSourceEntry[]> {
  const cap = COMPOSITE_LIMIT;
  const since = args.sinceTimestamp;

  return compositeHits(
    ctx,
    args,
    () =>
      ctx.db
        .query("saleBundles")
        .withIndex("by_status_and_bumped_at", (q) =>
          q.eq("status", "active").gt("bumpedAt", since)
        )
        .order("desc")
        .take(cap),
    () =>
      ctx.db
        .query("saleEvents")
        .withIndex("by_status_and_bumped_at", (q) =>
          q.eq("status", "active").gt("bumpedAt", since)
        )
        .order("desc")
        .take(cap)
  );
}

/**
 * Merge hits into one date-ordered page and hydrate the composites into the
 * exact card shapes `feed.getFeed` returns.
 */
async function mergeAndHydrate(ctx: QueryCtx, hits: FeedSourceEntry[], limit: number) {
  // Relevance selects the candidates; date orders them (rule 2).
  // ponytail: the 50-ad relevance cap is a relevance cut — a very old exact match
  // can fall out of the pool. Fine at current inventory; revisit if search feels
  // lossy. (Composites are capped separately, see COMPOSITE_LIMIT.)
  const merged = hits.sort((a, b) => b.doc.bumpedAt - a.doc.bumpedAt).slice(0, limit);

  return hydrateEntries(ctx, merged);
}

/**
 * Full-text search across every ad type, newest first.
 *
 * Search-only since the unified feed (Phase 3): browsing/pagination lives in
 * `feed.getFeed`; this survives for the home-feed search box and the
 * CommandPalette. Returns the top 50 matches in a single "page" (search
 * indexes don't cursor-paginate) — `paginationOpts` is accepted for
 * `usePaginatedQuery` compatibility but only shapes the response envelope.
 *
 * @param args.search - Search term (ad titles; composites' member titles)
 * @param args.categoryId - Filter by specific category (optional)
 * @param args.location - Filter by location string (optional, exact match)
 * @param args.paginationOpts - Pagination envelope (results are one page)
 *
 * Excludes `isSold` ads (same as `isDeleted`) — a sold item, standalone or bundled,
 * shouldn't browse as available. Direct links (e.g. a seller's own dashboard) still
 * resolve via `getAdById`, which is unfiltered.
 */
export const getAds = query({
  args: {
    categoryId: v.optional(v.id("categories")),
    search: v.string(),
    location: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const hits = await searchAllTypes(ctx, { ...args, limit: SEARCH_LIMIT });

    return {
      page: await mergeAndHydrate(ctx, hits, SEARCH_LIMIT),
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
 * @returns The same entries `getAds` returns, newest first — both branches
 *   cover all three ad types.
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
      const hits = await searchAllTypes(ctx, {
        search: args.search,
        categoryId: args.categoryId,
        location: args.location,
        sinceTimestamp: args.sinceTimestamp,
        limit,
      });

      return await mergeAndHydrate(ctx, hits, limit);
    } else {
      // `sinceTimestamp` is a `bumpedAt` watermark, not a creation time: the
      // rail surfaces brand-new AND boosted rows.
      let q = ctx.db
        .query("ads")
        .withIndex("by_bumped_at", (q) => q.gt("bumpedAt", args.sinceTimestamp))
        .order("desc");

      if (args.categoryId) {
        q = ctx.db
          .query("ads")
          // [categoryId, bumpedAt] supports .eq on the leading field AND a range
          // on the trailing one, so the watermark stays an index bound.
          .withIndex("by_category_and_bumped_at", (q) =>
            q.eq("categoryId", args.categoryId!).gt("bumpedAt", args.sinceTimestamp)
          )
          .order("desc");
      }

      // The rail is the ONLY path that re-injects new arrivals into the feed,
      // which is frozen at `maxSortTime` from mount — so composites ride it too.
      const [ads, composites] = await Promise.all([
        q
          .filter((q) =>
            q.and(
              q.eq(q.field("isActive"), true),
              q.neq(q.field("isDeleted"), true),
              q.neq(q.field("isSold"), true),
              args.location === undefined
                ? true
                : q.eq(q.field("location"), args.location)
            )
          )
          .take(limit),
        latestComposites(ctx, {
          categoryId: args.categoryId,
          location: args.location,
          sinceTimestamp: args.sinceTimestamp,
          limit,
        }),
      ]);

      return await mergeAndHydrate(
        ctx,
        [...ads.map((doc) => ({ kind: "ad" as const, doc })), ...composites],
        limit
      );
    }
  },
});
