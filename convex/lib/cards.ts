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
import { sectionRank, type FeedSection } from "./feedSections";
import { isNearComposite, type BuyerLocation } from "./nearby";

/**
 * Feed extraction, shared by `feed.getFeed` and `ads.getAds`. Both paths end at
 * `assembleFeedPage` below — the single assembly step — so a page shape cannot
 * diverge between the feed and search. `convex/feed.test.ts` runs identical
 * inputs through both queries and asserts identical output; that test, not this
 * comment, is what holds them together.
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
 * The section fields for one entry — THE single enforcement site of "stamp ONLY
 * when a location is set" (rule 5, `.agent/PRODUCT-RULES.md`: location groups,
 * it never hides). An unstamped entry is the default state, and `undefined`
 * fields are dropped before serialisation, which keeps the no-location response
 * byte-identical to the pre-section feed. (Fields, not a bare section value: a
 * helper answering "near" with no location set would break that guarantee.)
 *
 * `matches` is a boolean, and a section is a name — no distance or score is
 * returned, stored or compared anywhere downstream. See `./feedSections`.
 */
export function sectionFields(
  location: string | undefined,
  matches: boolean
): { section?: FeedSection } {
  return location ? { section: matches ? "near" : "far" } : {};
}

/**
 * A feed/search source entry before hydration. ONE definition — `feed.getFeed`
 * and `ads.getAds` must produce byte-identical page shapes.
 */
export type FeedSourceEntry =
  | { kind: "ad"; doc: Doc<"ads">; section?: FeedSection; pinned?: boolean }
  | { kind: "bundle"; doc: Doc<"saleBundles">; section?: FeedSection; pinned?: boolean }
  | { kind: "sale"; doc: Doc<"saleEvents">; section?: FeedSection; pinned?: boolean };

/** Standalone, live bundle (sale-suggestion bundles never feed). */
export const bundleIsLive = (b: Doc<"saleBundles">) => !b.saleEventId && b.isDeleted !== true;

/** Published, non-expired sale — same liveness rules as the feed's stream. */
export const saleIsLive = (s: Doc<"saleEvents">, now: number) =>
  Boolean(s.slug) && (!s.expiresAt || s.expiresAt > now);

/**
 * Category narrowing and the near/far test for a composite row. Shared by the feed's
 * `filterWith` callbacks and search's post-`take` predicates — one definition of
 * "does a composite match this filter?" (rules 1 and 4).
 */
export function compositeMatchesFilters(
  doc: Doc<"saleBundles"> | Doc<"saleEvents">,
  args: { categoryId?: Doc<"ads">["categoryId"]; buyer?: BuyerLocation }
): boolean {
  return (
    (!args.categoryId || (doc.categoryIds ?? []).includes(args.categoryId)) &&
    // Any-member test, like category: a composite is near as soon as one of its
    // members is (rule 1) — the nearest member decides. No live members = no
    // derived location records = it is near nobody. See ./nearby.
    (!args.buyer || isNearComposite(args.buyer, doc))
  );
}

/**
 * Hydrate a page of source entries into card shapes, dropping composites that
 * despawned (a bundle below BUNDLE_MIN_ITEMS visible members, a sale with none).
 * The despawn rule has exactly one enforcement site — this function.
 */
/** A hydrated feed page entry. `section` stays OPTIONAL — absent when no location is set. */
type FeedPageEntry =
  | { kind: "ad"; ad: Doc<"ads">; section?: FeedSection }
  | { kind: "bundle"; card: NonNullable<Awaited<ReturnType<typeof hydrateBundleCard>>>; section?: FeedSection }
  | { kind: "sale"; card: NonNullable<Awaited<ReturnType<typeof hydrateSaleCard>>>; section?: FeedSection };

async function hydrateEntries(
  ctx: QueryCtx,
  entries: FeedSourceEntry[]
): Promise<FeedPageEntry[]> {
  const hydrated = await Promise.all(
    entries.map(async (entry): Promise<FeedPageEntry | null> => {
      // Spread conditionally: `section: entry.section` would make the property
      // a required `… | undefined`, and an undefined field must stay genuinely
      // absent so the no-location response is byte-identical to before.
      const section = entry.section ? { section: entry.section } : {};
      switch (entry.kind) {
        case "ad":
          return { kind: "ad" as const, ad: entry.doc, ...section };
        case "bundle": {
          const card = await hydrateBundleCard(ctx, entry.doc);
          return card ? { kind: "bundle" as const, card, ...section } : null;
        }
        case "sale": {
          const card = await hydrateSaleCard(ctx, entry.doc);
          return card ? { kind: "sale" as const, card, ...section } : null;
        }
      }
    })
  );
  return hydrated.filter((e): e is NonNullable<typeof e> => e !== null);
}

/**
 * THE assembly step. Every feed path — `feed.getFeed`, `ads.getAds`,
 * `ads.getLatestAds` — hands its source entries to this function and returns
 * what comes back; nothing else orders, cuts or hydrates a page.
 *
 * WHICH entries survive and WHAT ORDER they render in are decided separately,
 * and they have to be:
 *
 * - **The cut ignores the section.** Search and the rail pool up to 2×limit rows
 *   across a pinned and an unpinned pass, so the trim has to drop some. If it
 *   dropped by section, the buyer's radius would decide which ads EXIST rather
 *   than which group they sit in — narrowing 25 km to 5 km would push an ad into
 *   the far group and straight off the end of the page. Rule 5 says location
 *   groups and never hides, so the cut ranks on `pinned` then `bumpedAt`, and
 *   the section is consulted only for the order below.
 * - **The order is section rank, then `bumpedAt` desc within each.** Grouping,
 *   not ordering (rule 2): newest is still on top of every group, and no
 *   distance or score exists to sort on.
 *
 * `pinned` is stamped by the callers (`sectionedAdHits` / `compositeHits`,
 * convex/ads.ts) and means **near at the WIDEST rung the buyer's control offers**
 * — `atWidestRadius`, a constant — plus whatever the same-suburb pass fetched.
 * A constant threshold is what makes this work in both directions at once:
 *
 * - It does not move when the buyer narrows their radius, so the surviving SET
 *   is radius-independent — changing the distance regroups, never removes.
 * - Everything near at the buyer's own radius is near at the widest one, so an
 *   in-area entry is not cut in favour of a newer out-of-area entry.
 *
 * Do not "simplify" `pinned` back to a location-string match. It reads like the
 * obvious definition and it silently drops the second guarantee.
 * `nearby.test.ts` is the contract for both — it fails on a section-ranked cut,
 * on a string-only `pinned`, and on a threshold that follows the buyer's radius.
 *
 * ponytail: this protects rows that REACHED the pool. It does not widen the DB
 * pass — that is still `.eq("location", …)`, so a row near only by distance or
 * SA4 can be cut by the `.take()` before any of this runs. Two different levels;
 * only the second is still open. It is the known ceiling recorded on
 * `sectionedAdHits`, and the fix is a server-side near lane pinned on `sa4Code`.
 */
export async function assembleFeedPage(
  ctx: QueryCtx,
  entries: FeedSourceEntry[],
  limit?: number
): Promise<FeedPageEntry[]> {
  const kept =
    limit === undefined
      ? entries
      : [...entries]
          .sort(
            (a, b) =>
              Number(b.pinned ?? false) - Number(a.pinned ?? false) ||
              b.doc.bumpedAt - a.doc.bumpedAt
          )
          .slice(0, limit);
  const ordered = [...kept].sort(
    (a, b) =>
      sectionRank(a.section) - sectionRank(b.section) || b.doc.bumpedAt - a.doc.bumpedAt
  );
  return hydrateEntries(ctx, ordered);
}
