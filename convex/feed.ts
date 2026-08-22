import { v } from "convex/values";
import { query } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { stream, mergedStream } from "convex-helpers/server/stream";
import type { QueryStream } from "convex-helpers/server/stream";
import schema from "./schema";
import {
  bundleIsLive,
  compositeMatchesFilters,
  hydrateEntries,
  saleIsLive,
  type FeedSourceEntry,
} from "./lib/cards";
import { isFlagEnabled } from "./featureFlags";

/**
 * Unified home feed (Phase 2 of docs/superpowers/specs/2026-07-16-unified-feed-pagination-design.md).
 *
 * One paginated query interleaving standard ads, standalone Bundle cards, and
 * Moving Sale cards on the shared `bumpedAt` sort key via convex-helpers
 * `mergedStream`. Replaced the client-side three-query merge (getAds +
 * getActiveBundleFeedCards + getActiveSales) — the latter two were deleted in
 * Phase 3 (home feed was their only caller); getAds survives for search and
 * the CommandPalette. Card hydration below preserves their exact shapes.
 *
 * Streams are merged on ["bumpedAt", "_creationTime", "_id"] — the real
 * mergedStream API requires the FULL non-equality suffix of each stream's index
 * fields (the spec's sketch said ["bumpedAt"]; the implicit system tie-breakers
 * must be included). All three indexes end in [..., "bumpedAt"], so after the
 * composites' `.eq("status", "active")` every stream is ordered by exactly
 * these fields.
 */

// Full non-equality index suffix shared by all three streams (see doc comment).
const FEED_ORDER_FIELDS = ["bumpedAt", "_creationTime", "_id"];

/**
 * The unified paginated home feed.
 *
 * @param args.paginationOpts - Pagination cursor and page size.
 * @param args.categoryId - Category filter (optional). Applies to all three ad
 *   types; a composite matches when any member ad is in the category (rules 1
 *   and 4, `.agent/PRODUCT-RULES.md`).
 * @param args.location - Location filter (optional, exact match on the ad's
 *   `location`). Applies to all three ad types; a composite matches on its
 *   derived `location` (copied from its first live member). A composite with no
 *   derived location does NOT match (rules 1 and 4).
 * @param args.maxSortTime - Upper bound on the `bumpedAt` sort key for stable
 *   pagination; frozen at mount by the client (see MarketplaceContext).
 * @returns Standard pagination result whose `page` is a discriminated union:
 *   `{ kind: "ad", ad } | { kind: "bundle", card } | { kind: "sale", card }`.
 *   Card shapes match `getActiveBundleFeedCards` / `getActiveSales` so the
 *   existing card components consume them unchanged. Composites are hydrated
 *   per page only; a bundle whose live members drop below 2 is excluded, which
 *   can shrink a page by a card (accepted, spec §4).
 */
export const getFeed = query({
  args: {
    paginationOpts: paginationOptsValidator,
    categoryId: v.optional(v.id("categories")),
    location: v.optional(v.string()),
    maxSortTime: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const maxSortTime = args.maxSortTime ?? Date.now();

    // Merge the three sources on bumpedAt desc. Feature flags are read
    // server-side; a disabled flag excludes its stream.
    const [bundlesEnabled, salesEnabled] = await Promise.all([
      isFlagEnabled(ctx, "bundleListing"),
      isFlagEnabled(ctx, "movingSaleMode"),
    ]);

    const streams: QueryStream<FeedSourceEntry>[] = [
      // Standard ads — same predicate set as getAds.
      (args.categoryId
        ? stream(ctx.db, schema)
            .query("ads")
            .withIndex("by_category_and_bumped_at", (q) =>
              q.eq("categoryId", args.categoryId!).lte("bumpedAt", maxSortTime)
            )
        : stream(ctx.db, schema)
            .query("ads")
            .withIndex("by_bumped_at", (q) => q.lte("bumpedAt", maxSortTime))
      )
        .order("desc")
        .filterWith(
          async (ad) =>
            ad.isActive &&
            ad.isDeleted !== true &&
            ad.isSold !== true &&
            (!args.location || ad.location === args.location)
        )
        .map(async (doc) => ({ kind: "ad" as const, doc })),
    ];

    if (bundlesEnabled) {
      streams.push(
        // Standalone active bundles only — sale-suggestion bundles never feed.
        stream(ctx.db, schema)
          .query("saleBundles")
          .withIndex("by_status_and_bumped_at", (q) =>
            q.eq("status", "active").lte("bumpedAt", maxSortTime)
          )
          .order("desc")
          .filterWith(async (b) => bundleIsLive(b) && compositeMatchesFilters(b, args))
          .map(async (doc) => ({ kind: "bundle" as const, doc }))
      );
    }

    if (salesEnabled) {
      const now = Date.now();
      streams.push(
        // Published, non-expired sales — same liveness rules as getActiveSales.
        stream(ctx.db, schema)
          .query("saleEvents")
          .withIndex("by_status_and_bumped_at", (q) =>
            q.eq("status", "active").lte("bumpedAt", maxSortTime)
          )
          .order("desc")
          .filterWith(async (s) => saleIsLive(s, now) && compositeMatchesFilters(s, args))
          .map(async (doc) => ({ kind: "sale" as const, doc }))
      );
    }

    const result = await mergedStream(streams, FEED_ORDER_FIELDS).paginate(
      args.paginationOpts
    );

    // Hydrate composites per page only (~0–2 per page in practice).
    return { ...result, page: await hydrateEntries(ctx, result.page) };
  },
});
