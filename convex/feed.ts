import { v } from "convex/values";
import { query } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { stream, mergedStream } from "convex-helpers/server/stream";
import type { QueryStream } from "convex-helpers/server/stream";
import schema from "./schema";
import type { Doc } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import {
  BUNDLE_MIN_ITEMS,
  computeSavings,
  hydrateBundleItems,
  separatelyTotal,
} from "./bundles";
import { saleItems } from "./saleEvents";

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
 *
 * `bumpedAt` is still OPTIONAL on saleBundles/saleEvents (widen→backfill→narrow
 * rollout). Convex sorts undefined below every number, so a legacy un-backfilled
 * row would land inside the `lte` range and sink to the very end of the feed
 * with no usable sort key — the composite streams filter `bumpedAt !== undefined`
 * so such rows are excluded outright until the field is narrowed to required.
 */

// The page is a discriminated union so the client renders each entry with the
// existing card components unchanged.
type FeedSourceEntry =
  | { kind: "ad"; doc: Doc<"ads"> }
  | { kind: "bundle"; doc: Doc<"saleBundles"> }
  | { kind: "sale"; doc: Doc<"saleEvents"> };

// Full non-equality index suffix shared by all three streams (see doc comment).
const FEED_ORDER_FIELDS = ["bumpedAt", "_creationTime", "_id"];

async function isFlagEnabled(ctx: QueryCtx, key: string): Promise<boolean> {
  const flag = await ctx.db
    .query("featureFlags")
    .withIndex("by_key", (q) => q.eq("key", key))
    .first();
  return flag?.enabled ?? false;
}

/**
 * Hydrate a bundle row into the feed card shape (identical to
 * `bundles.getActiveBundleFeedCards`). Returns null — excluding the bundle from
 * the page — when fewer than BUNDLE_MIN_ITEMS live (non-deleted, non-sold)
 * members remain (the "despawn below 2" render rule).
 */
async function hydrateBundleCard(ctx: QueryCtx, bundle: Doc<"saleBundles">) {
  const items = await hydrateBundleItems(ctx, bundle.adIds, { excludeSold: true });
  if (items.length < BUNDLE_MIN_ITEMS) return null;
  const total = separatelyTotal(items);
  const { savings } = computeSavings(total, bundle.bundlePrice);
  return {
    _id: bundle._id,
    label: bundle.label,
    createdAt: bundle._creationTime,
    itemCount: items.length,
    location: items[0]?.location ?? "",
    bundlePrice: bundle.bundlePrice,
    separatelyTotal: total,
    savings,
    covers: items.map((i) => i.images[0]).filter((s): s is string => Boolean(s)),
    adIds: items.map((i) => i._id), // member ads (thumbnail links etc.)
  };
}

/**
 * Hydrate a sale event into the feed card shape (identical to
 * `saleEvents.getActiveSales`).
 */
async function hydrateSaleCard(ctx: QueryCtx, sale: Doc<"saleEvents">) {
  const items = await saleItems(ctx, sale._id);
  const withPhotos = items.filter((i) => i.images.length > 0);
  const prices = items.map((i) => i.price ?? 0).filter((p) => p > 0);
  return {
    _id: sale._id,
    slug: sale.slug as string,
    title: sale.title,
    suburb: sale.suburb,
    createdAt: sale.createdAt,
    itemCount: items.length,
    photoCount: withPhotos.length,
    minPrice: prices.length ? Math.min(...prices) : 0,
    covers: withPhotos.slice(0, 3).map((i) => i.images[0]),
  };
}

/**
 * The unified paginated home feed.
 *
 * @param args.paginationOpts - Pagination cursor and page size.
 * @param args.categoryId - Category filter (optional). When set, the feed is
 *   ads-only — composites never appear on category feeds (documented decision).
 * @param args.maxSortTime - Upper bound on the `bumpedAt` sort key for stable
 *   pagination; same freeze-at-mount contract as `ads.getAds`.
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
    maxSortTime: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const maxSortTime = args.maxSortTime || Date.now();

    // ── Category branch: ads only, logic identical to getAds' category branch.
    if (args.categoryId) {
      const result = await ctx.db
        .query("ads")
        .withIndex("by_category_and_bumped_at", (q) =>
          q.eq("categoryId", args.categoryId!).lte("bumpedAt", maxSortTime)
        )
        .order("desc")
        .filter((q) =>
          q.and(
            q.eq(q.field("isActive"), true),
            q.neq(q.field("isDeleted"), true),
            q.neq(q.field("isSold"), true)
          )
        )
        .paginate(args.paginationOpts);
      return {
        ...result,
        page: result.page.map((ad) => ({ kind: "ad" as const, ad })),
      };
    }

    // ── Uncategorised branch: merge the three sources on bumpedAt desc.
    // Feature flags are read server-side; a disabled flag excludes its stream.
    const [bundlesEnabled, salesEnabled] = await Promise.all([
      isFlagEnabled(ctx, "bundleListing"),
      isFlagEnabled(ctx, "movingSaleMode"),
    ]);

    const streams: QueryStream<FeedSourceEntry>[] = [
      // Standard ads — same predicate set as getAds' non-category branch.
      stream(ctx.db, schema)
        .query("ads")
        .withIndex("by_bumped_at", (q) => q.lte("bumpedAt", maxSortTime))
        .order("desc")
        .filterWith(
          async (ad) => ad.isActive && ad.isDeleted !== true && ad.isSold !== true
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
          .filterWith(
            async (b) =>
              b.bumpedAt !== undefined && !b.saleEventId && b.isDeleted !== true
          )
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
          .filterWith(
            async (s) =>
              s.bumpedAt !== undefined &&
              Boolean(s.slug) &&
              (!s.expiresAt || s.expiresAt > now)
          )
          .map(async (doc) => ({ kind: "sale" as const, doc }))
      );
    }

    const result = await mergedStream(streams, FEED_ORDER_FIELDS).paginate(
      args.paginationOpts
    );

    // Hydrate composites per page only (~0–2 per page in practice).
    const hydrated = await Promise.all(
      result.page.map(async (entry) => {
        switch (entry.kind) {
          case "ad":
            return { kind: "ad" as const, ad: entry.doc };
          case "bundle": {
            const card = await hydrateBundleCard(ctx, entry.doc);
            return card ? { kind: "bundle" as const, card } : null;
          }
          case "sale": {
            const card = await hydrateSaleCard(ctx, entry.doc);
            return { kind: "sale" as const, card };
          }
        }
      })
    );

    return {
      ...result,
      page: hydrated.filter((e): e is NonNullable<typeof e> => e !== null),
    };
  },
});
