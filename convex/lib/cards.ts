import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import {
  BUNDLE_MIN_ITEMS,
  computeSavings,
  hydrateBundleItems,
  separatelyTotal,
} from "../bundles";
import { saleItems } from "../saleEvents";
import { adIsVisible } from "./derive";

/**
 * Feed card hydration, shared by `feed.getFeed` and `ads.getAds` so a card shape
 * can never diverge between the feed and search. Moved verbatim out of
 * `convex/feed.ts`.
 */

/**
 * Hydrate a bundle row into the feed card shape (identical to
 * `bundles.getActiveBundleFeedCards`). Returns null — excluding the bundle from
 * the page — when fewer than BUNDLE_MIN_ITEMS visible members remain (the
 * "despawn below 2" render rule).
 *
 * Visible = `adIsVisible`, the SAME predicate derivation uses. A card must never
 * render a member the composite's `categoryIds` / `locations` were derived
 * without, or the card appears unfiltered and vanishes the moment a filter is
 * set (rule 4). `{ excludeSold: true }` was a near-miss: it kept deactivated ads.
 */
export async function hydrateBundleCard(ctx: QueryCtx, bundle: Doc<"saleBundles">) {
  const items = (await hydrateBundleItems(ctx, bundle.adIds)).filter(adIsVisible);
  if (items.length < BUNDLE_MIN_ITEMS) return null;
  const total = separatelyTotal(items);
  const { savings } = computeSavings(total, bundle.bundlePrice);
  return {
    _id: bundle._id,
    label: bundle.label,
    createdAt: bundle._creationTime,
    bumpedAt: bundle.bumpedAt,
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
 * `saleEvents.getActiveSales`). Returns null — excluding the sale from the page —
 * when no visible member remains, mirroring the bundle despawn rule.
 *
 * Visible = `adIsVisible`, the same predicate derivation uses. Counting every
 * non-deleted item instead let an all-sold sale render a live card claiming "12
 * items" while `categoryIds`/`locations` derived to empty: it showed in the
 * unfiltered feed and in no filtered one (rule 4). `itemCount`, `photoCount`,
 * the price range and the covers all count visible members only, for the same
 * reason — a card must describe what a buyer can actually still buy.
 */
export async function hydrateSaleCard(ctx: QueryCtx, sale: Doc<"saleEvents">) {
  const items = (await saleItems(ctx, sale._id)).filter(adIsVisible);
  if (items.length === 0) return null;
  const withPhotos = items.filter((i) => i.images.length > 0);
  // Rule 1: "if a member matches, the card matches". A price filter asks about
  // members, so the card carries every member price — a min/max range would
  // admit a sale holding a $5 mug and a $5000 couch into a $100–$200 filter with
  // nothing in the band (rule 5, "showing non-matching items to pad a search").
  // Sorted + deduped: the client only ever asks "does any of these match?", and
  // display reads prices[0] as the "from $X" floor.
  const prices = [
    ...new Set(items.map((i) => i.price ?? 0).filter((p) => p > 0)),
  ].sort((a, b) => a - b);
  return {
    _id: sale._id,
    slug: sale.slug as string,
    title: sale.title,
    suburb: sale.suburb,
    createdAt: sale.createdAt,
    bumpedAt: sale.bumpedAt,
    itemCount: items.length,
    photoCount: withPhotos.length,
    minPrice: prices[0] ?? 0,
    prices,
    covers: withPhotos.slice(0, 3).map((i) => i.images[0]),
  };
}

/**
 * A feed/search source entry before hydration. ONE definition — `feed.getFeed`
 * and `ads.getAds` must produce byte-identical page shapes.
 */
export type FeedSourceEntry =
  | { kind: "ad"; doc: Doc<"ads"> }
  | { kind: "bundle"; doc: Doc<"saleBundles"> }
  | { kind: "sale"; doc: Doc<"saleEvents"> };

/** Standalone, live bundle (sale-suggestion bundles never feed). */
export const bundleIsLive = (b: Doc<"saleBundles">) => !b.saleEventId && b.isDeleted !== true;

/** Published, non-expired sale — same liveness rules as the feed's stream. */
export const saleIsLive = (s: Doc<"saleEvents">, now: number) =>
  Boolean(s.slug) && (!s.expiresAt || s.expiresAt > now);

/**
 * Category/location narrowing for a composite row. Shared by the feed's
 * `filterWith` callbacks and search's post-`take` predicates — one definition of
 * "does a composite match this filter?" (rules 1 and 4).
 */
export function compositeMatchesFilters(
  doc: Doc<"saleBundles"> | Doc<"saleEvents">,
  args: { categoryId?: Doc<"ads">["categoryId"]; location?: string }
): boolean {
  return (
    (!args.categoryId || (doc.categoryIds ?? []).includes(args.categoryId)) &&
    // Any-member test, like category: a composite matches a location as soon as
    // one of its members is there (rule 1). No live members = no locations = it
    // matches none.
    (!args.location || (doc.locations ?? []).includes(args.location))
  );
}

/**
 * Hydrate a page of source entries into card shapes, dropping composites that
 * despawned (a bundle below BUNDLE_MIN_ITEMS visible members, a sale with none).
 * The despawn rule has exactly one enforcement site — this function.
 */
export async function hydrateEntries(ctx: QueryCtx, entries: FeedSourceEntry[]) {
  const hydrated = await Promise.all(
    entries.map(async (entry) => {
      switch (entry.kind) {
        case "ad":
          return { kind: "ad" as const, ad: entry.doc };
        case "bundle": {
          const card = await hydrateBundleCard(ctx, entry.doc);
          return card ? { kind: "bundle" as const, card } : null;
        }
        case "sale": {
          const card = await hydrateSaleCard(ctx, entry.doc);
          return card ? { kind: "sale" as const, card } : null;
        }
      }
    })
  );
  return hydrated.filter((e): e is NonNullable<typeof e> => e !== null);
}
