import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

import { paginationOptsValidator } from "convex/server";
import {
  assembleFeedPage,
  bundleIsLive,
  compositeMatchesFilters,
  saleIsLive,
  sectionFields,
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
  // Rule 5: category narrows (a requirement); location only SECTIONS (a
  // preference). Composites need no second DB pass — the location narrowing
  // here was always a JS predicate below the `.take(cap)`, never a DB cut, so
  // the same predicate now stamps the section instead of dropping the row.
  const sectionOf = (doc: Doc<"saleBundles"> | Doc<"saleEvents">) =>
    sectionFields(args.location, compositeMatchesFilters(doc, { location: args.location }));
  return [
    ...bundles
      .filter((b) => bundleIsLive(b) && compositeMatchesFilters(b, { categoryId: args.categoryId }))
      .map((doc) => ({ kind: "bundle" as const, doc, ...sectionOf(doc) })),
    ...sales
      .filter((s) => saleIsLive(s, now) && compositeMatchesFilters(s, { categoryId: args.categoryId }))
      .map((doc) => ({ kind: "sale" as const, doc, ...sectionOf(doc) })),
  ];
}

/**
 * Rule 5 two-pass ads fetch, shared by search and the rail. Both cut with a
 * `.take()` INSIDE the DB query (by relevance for search, by date for the
 * rail), so one unpinned pass can lose near rows before any JS runs — a
 * post-hoc partition cannot resurrect them. With a location set: a
 * location-pinned "near" pass plus an unpinned "far" pass, deduped on `_id`.
 * With none: one unpinned pass, no section.
 */
async function sectionedAdHits(
  location: string | undefined,
  pass: (location?: string) => Promise<Doc<"ads">[]>
): Promise<FeedSourceEntry[]> {
  if (!location) {
    return (await pass()).map((doc) => ({ kind: "ad" as const, doc }));
  }
  const [near, unpinned] = await Promise.all([pass(location), pass()]);
  const nearIds = new Set(near.map((d) => d._id));
  return [
    ...near.map((doc) => ({ kind: "ad" as const, doc, section: "near" as const })),
    ...unpinned
      .filter((d) => !nearIds.has(d._id))
      .map((doc) => ({ kind: "ad" as const, doc, section: "far" as const })),
  ];
}

/**
 * Run the three search indexes (ads + both composite tables) concurrently and
 * return the raw hits.
 *
 * A composite matches when any MEMBER ad matches — that's what `searchText`
 * holds. Category narrows all three tables (rules 1 and 4,
 * `.agent/PRODUCT-RULES.md`): on `ads` as an index filter field, on composites
 * as a post-search predicate over the derived `categoryIds`. `location` never
 * narrows — it stamps `section: "near" | "far"` on every hit instead (rule 5).
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
  const searchAdsPass = (location?: string) =>
    ctx.db
      .query("ads")
      .withSearchIndex("search_ads", (q) => {
        let searchQuery = q.search("title", args.search);

        if (args.categoryId) {
          searchQuery = searchQuery.eq("categoryId", args.categoryId);
        }
        if (location) {
          searchQuery = searchQuery.eq("location", location);
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
      .take(args.limit);
  const [ads, composites] = await Promise.all([
    sectionedAdHits(args.location, searchAdsPass),
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

  return [...ads, ...composites];
}

/**
 * The browse counterpart of `searchAllTypes`: every composite bumped since the
 * watermark, ordered by `bumpedAt` desc via `by_status_and_bumped_at`;
 * `assembleFeedPage` interleaves them with the ads (rule 2).
 *
 * Rule 5 caveat (recorded so it isn't re-derived): this `.take(cap)` IS a
 * DB-level date cut, and no location-pinned pass is possible — neither
 * composite table has a location index. A near composite below `cap` fresher
 * far ones is lost. Out of scope: it needs >COMPOSITE_LIMIT composites bumped
 * inside one 60s window; the fix would be raising the cap when a location is
 * set.
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
 * Relevance selects the candidates; `assembleFeedPage` (convex/lib/cards.ts)
 * groups and orders them — the SAME assembly step `feed.getFeed` ends at, so a
 * page cannot differ between browse and search.
 *
 * ponytail: the 50-ad relevance cap is a relevance cut — a very old exact match
 * can fall out of the pool. Fine at current inventory; revisit if search feels
 * lossy. (Composites are capped separately, see COMPOSITE_LIMIT.)
 */

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
 * @param args.location - Location preference (optional, exact match): groups
 *   results into the near/far sections instead of filtering (rule 5)
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
      page: await assembleFeedPage(ctx, hits, SEARCH_LIMIT),
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
 * @param args.location - Location preference (optional): sections results
 *   near/far instead of filtering (rule 5)
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

      return await assembleFeedPage(ctx, hits, limit);
    } else {
      // `sinceTimestamp` is a `bumpedAt` watermark, not a creation time: the
      // rail surfaces brand-new AND boosted rows. The `.take(limit)` is a
      // DB-level DATE cut — hence `sectionedAdHits`' pinned near pass (rule 5).
      const latestAdsPass = (location?: string) => {
        const q = args.categoryId
          ? ctx.db
              .query("ads")
              // [categoryId, bumpedAt] supports .eq on the leading field AND a
              // range on the trailing one, so the watermark stays an index bound.
              .withIndex("by_category_and_bumped_at", (q) =>
                q.eq("categoryId", args.categoryId!).gt("bumpedAt", args.sinceTimestamp)
              )
          : ctx.db
              .query("ads")
              .withIndex("by_bumped_at", (q) => q.gt("bumpedAt", args.sinceTimestamp));
        return q
          .order("desc")
          .filter((q) =>
            q.and(
              q.eq(q.field("isActive"), true),
              q.neq(q.field("isDeleted"), true),
              q.neq(q.field("isSold"), true),
              location === undefined ? true : q.eq(q.field("location"), location)
            )
          )
          .take(limit);
      };

      // The rail is the ONLY path that re-injects new arrivals into the feed,
      // which is frozen at `maxSortTime` from mount — so composites ride it too.
      const [ads, composites] = await Promise.all([
        sectionedAdHits(args.location, latestAdsPass),
        latestComposites(ctx, {
          categoryId: args.categoryId,
          location: args.location,
          sinceTimestamp: args.sinceTimestamp,
          limit,
        }),
      ]);

      return await assembleFeedPage(ctx, [...ads, ...composites], limit);
    }
  },
});
