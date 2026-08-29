import { v } from "convex/values";
import { query } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { stream, mergedStream } from "convex-helpers/server/stream";
import type { QueryStream } from "convex-helpers/server/stream";
import schema from "./schema";
import {
  assembleFeedPage,
  bundleIsLive,
  compositeMatchesFilters,
  saleIsLive,
  sectionFields,
  type FeedSourceEntry,
} from "./lib/cards";
import { isFlagEnabled } from "./featureFlags";
import { locationMetaValidator } from "./lib/location";
import { resolveBuyer, isNearAd } from "./lib/nearby";

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
 * @param args.location - Location preference (optional). Rule 5: it GROUPS, it
 *   never hides — every entry is stamped `section: "near" | "far"`
 *   (convex/lib/feedSections.ts) instead of being filtered, and the page is
 *   grouped by section — newest first inside each, which is grouping, not
 *   ordering (rule 2). A composite is "near" when ANY of its members is — a
 *   bundle can span suburbs; a composite with no derived location records is
 *   "far" (rules 1 and 4).
 * @param args.locationMeta - The record behind that suburb, captured where the
 *   buyer picked it. What makes "near" mean a distance rather than an identical
 *   suburb NAME (convex/lib/nearby.ts). Absent = the old string test.
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
    locationMeta: v.optional(locationMetaValidator),
    maxSortTime: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const maxSortTime = args.maxSortTime ?? Date.now();
    // The buyer's picked suburb record + the admin-tuned radius (convex/lib/nearby.ts).
    // Undefined when no location is set, which is what leaves every entry unsectioned.
    const buyer = await resolveBuyer(ctx, args.location, args.locationMeta);

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
          async (ad) => ad.isActive && ad.isDeleted !== true && ad.isSold !== true
        )
        // Rule 5: location SECTIONS an entry, it never filters (sectionFields
        // stamps only when a location is set).
        .map(async (doc) => ({
          kind: "ad" as const,
          doc,
          ...sectionFields(args.location, isNearAd(buyer, doc)),
        })),
    ];

    if (bundlesEnabled) {
      streams.push(
        // Standalone active bundles only — sale-suggestion bundles never feed.
        // Category stays a requirement (filtered); location only sections.
        stream(ctx.db, schema)
          .query("saleBundles")
          .withIndex("by_status_and_bumped_at", (q) =>
            q.eq("status", "active").lte("bumpedAt", maxSortTime)
          )
          .order("desc")
          .filterWith(
            async (b) =>
              bundleIsLive(b) && compositeMatchesFilters(b, { categoryId: args.categoryId })
          )
          .map(async (doc) => ({
            kind: "bundle" as const,
            doc,
            ...sectionFields(args.location, compositeMatchesFilters(doc, { buyer })),
          }))
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
          .filterWith(
            async (s) =>
              saleIsLive(s, now) && compositeMatchesFilters(s, { categoryId: args.categoryId })
          )
          .map(async (doc) => ({
            kind: "sale" as const,
            doc,
            ...sectionFields(args.location, compositeMatchesFilters(doc, { buyer })),
          }))
      );
    }

    const result = await mergedStream(streams, FEED_ORDER_FIELDS).paginate(
      args.paginationOpts
    );

    // One assembly step, shared with search (convex/lib/cards.ts): it groups the
    // page by section and hydrates the composites (~0–2 per page in practice).
    return { ...result, page: await assembleFeedPage(ctx, result.page) };
  },
});
