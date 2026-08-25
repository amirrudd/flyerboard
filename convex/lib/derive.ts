import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

/**
 * Composite derivation — rule 1, "an aggregation inherits from its members"
 * (`.agent/PRODUCT-RULES.md`). A Bundle or Moving Sale has no category, location
 * or searchable text of its own; it has whatever its member ads have. Those
 * values are denormalised onto the composite row because a search index needs
 * its text at index time, and because a location filter can only reach a field
 * that lives on the row it filters (rule 4: no filter a card type is exempt from).
 *
 * This file owns BOTH halves of "who are the members?" — the loaders
 * (`hydrateBundleItems` / `saleItems`, re-exported from `bundles.ts` and
 * `saleEvents.ts` for their historical importers) and the visibility predicate
 * (`adIsVisible`). Derivation used to re-implement the loaders and merely assert
 * in a comment that the two agreed.
 */

/** The only member-ad fields derivation reads. */
type Member = Pick<Doc<"ads">, "title" | "categoryId" | "location">;

export type DerivedComposite = {
  categoryIds: Id<"categories">[];
  searchText: string;
  /** Empty when there are no live members — the row then matches no location. */
  locations: string[];
};

/** Auto-name a bundle from its first couple of item titles ("Sofa + Dining table"). */
export function autoLabel(titles: string[]): string {
  const clean = titles.map((t) => t.trim()).filter(Boolean);
  if (clean.length === 0) return "Bundle";
  const label = clean.length <= 2 ? clean.join(" + ") : `${clean[0]} + ${clean.length - 1} more`;
  return label.slice(0, 80);
}

/**
 * Pure half. `categoryIds` = the distinct categories of the members;
 * `searchText` = the composite's own label followed by every member title;
 * `locations` = the distinct `location` of every live member.
 *
 * A LIST, exactly like `categoryIds`. Nothing validates that a bundle's members
 * share an address — `createBundle` takes any of the seller's ads — so the
 * previous "members are collected in one place, take the first one's location"
 * was an unenforced premise: a bundle whose second member sat in another suburb
 * was invisible to that suburb's filter while its member was not (rule 1,
 * "anything true of a member is true of the card that contains it"). Matching is
 * `locations.includes(filter)`, the same any-member test category already used.
 *
 * The ad rows carry the canonical `formatLocation()` string, which is what makes
 * a composite match the same location filter an ad does. Since 2026-08-22
 * `saleEvents.suburb` is that string too (the setup step uses the shared picker),
 * so a sale item born with `location: sale.suburb` is canonical from the start.
 */
export function deriveFromMembers(members: Member[], label?: string): DerivedComposite {
  const categoryIds = [...new Set(members.map((m) => m.categoryId))];
  const searchText = [label ?? "", ...members.map((m) => m.title)]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(" ");
  return { categoryIds, searchText, locations: [...new Set(members.map((m) => m.location))] };
}

/**
 * ONE definition of "does this ad count towards its composite?" — an ad counts
 * exactly while it is reachable as an ad in its own right: not deleted, not sold,
 * not deactivated.
 *
 * Sold members used to count, on the argument that "a sold item still explains
 * why the card is in a category". That was a code comment, not a product
 * decision, and it made the card contradict the reason it was found: a bundle
 * whose only desk had sold still answered a "desk" search, while the card it
 * rendered showed no desk anywhere (rule 1, "anything true of a member is true
 * of the card"; rule 5, "showing non-matching items to pad a search"). The same
 * argument applies to `isActive`: a deactivated ad is dropped from search as an
 * ad, so a composite must not be reachable through one either.
 *
 * `cards.ts` used to carry two near-duplicates of this test — `hydrateBundleItems`
 * with `{ excludeSold: true }` in `hydrateBundleCard`, and the bare non-deleted
 * `saleItems` in `hydrateSaleCard`. Both now call this predicate, so a card can
 * no longer render members that derivation has already discounted (the sale half
 * of that mismatch rendered an all-sold sale that matched no filter at all). The
 * `search_ads` index predicate is the one remaining near-duplicate, and it is a
 * Convex index filter, not JS.
 */
export const adIsVisible = (ad: Doc<"ads"> | null | undefined): ad is Doc<"ads"> =>
  !!ad && ad.isDeleted !== true && ad.isSold !== true && ad.isActive !== false;

/**
 * Resolve a bundle's `adIds` into live ad docs (concurrently), dropping deleted/
 * missing ones. Re-exported from `bundles.ts` for its existing importers.
 */
export async function hydrateBundleItems(
  ctx: QueryCtx | MutationCtx,
  adIds: Id<"ads">[]
): Promise<Doc<"ads">[]> {
  const ads = await Promise.all(adIds.map((id) => ctx.db.get(id)));
  return ads.filter((a): a is Doc<"ads"> => a !== null && !a.isDeleted);
}

/**
 * Non-deleted ads belonging to a sale event.
 * Re-exported from `saleEvents.ts` for its existing importers.
 */
export async function saleItems(
  ctx: QueryCtx | MutationCtx,
  saleEventId: Id<"saleEvents">
): Promise<Doc<"ads">[]> {
  return ctx.db
    .query("ads")
    .withIndex("by_sale_event", (q) => q.eq("saleEventId", saleEventId))
    .filter((q) => q.neq(q.field("isDeleted"), true))
    .collect();
}

/**
 * Derive-and-patch for a bundle row already in hand (no re-read). Idempotent.
 *
 * A sale-suggestion bundle (one with a `saleEventId`) is skipped: `cards.bundleIsLive`
 * rejects every such bundle, so nothing can ever read its derived fields — but
 * `search_composite` filters only on `status`, so an indexed one is still returned
 * by the search index, eats the candidate budget, and is then discarded in JS. Its
 * derived fields are cleared instead, which un-indexes it (`searchText` undefined).
 */
export async function refreshBundleDerived(
  ctx: MutationCtx,
  bundle: Doc<"saleBundles">
): Promise<void> {
  if (bundle.saleEventId) {
    await ctx.db.patch(bundle._id, {
      searchText: undefined,
      categoryIds: undefined,
      locations: undefined,
    });
    return;
  }
  const members = (await hydrateBundleItems(ctx, bundle.adIds)).filter(adIsVisible);
  // An auto-generated label is a view of the members and must follow them —
  // otherwise the card keeps reading "Desk + 2 more" after the desk is gone.
  // A seller's own label is never touched. `labelIsAuto` absent = legacy row:
  // treat as NOT auto. Silently rewriting labels sellers have been looking at
  // would be a worse regression than the drift we are fixing.
  const label = bundle.labelIsAuto === true ? autoLabel(members.map((m) => m.title)) : bundle.label;
  await ctx.db.patch(bundle._id, { ...deriveFromMembers(members, label), label });
}

/** Derive-and-patch for a sale row already in hand (no re-read). Idempotent. */
export async function refreshSaleDerived(
  ctx: MutationCtx,
  sale: Doc<"saleEvents">
): Promise<void> {
  const members = (await saleItems(ctx, sale._id)).filter(adIsVisible);
  // A sale's title is always seller-authored — never regenerated.
  await ctx.db.patch(sale._id, deriveFromMembers(members, sale.title));
}

/**
 * Ctx-taking half: reload the composite and its members, derive, patch. Idempotent,
 * and a no-op when the composite no longer exists. Call from every site that
 * changes membership, or a member's category, title, location, sold or active state.
 */
export async function refreshCompositeDerived(
  ctx: MutationCtx,
  target: { bundleId: Id<"saleBundles"> } | { saleEventId: Id<"saleEvents"> }
): Promise<void> {
  if ("bundleId" in target) {
    const bundle = await ctx.db.get(target.bundleId);
    if (bundle) await refreshBundleDerived(ctx, bundle);
    return;
  }
  const sale = await ctx.db.get(target.saleEventId);
  if (sale) await refreshSaleDerived(ctx, sale);
}

/**
 * Re-derive every composite this ad belongs to (rule 1 — "an aggregation inherits
 * from its members"). Call after ANY write to an ad's membership, `title`,
 * `categoryId`, `location`, `isDeleted`, `isSold` or `isActive`. Idempotent; safe
 * to over-call.
 *
 * This is the SINGLE owner of re-derivation on the ad write path — `detachAdFromBundle`
 * deliberately does not refresh, so pass the ad doc AS IT WAS BEFORE the write
 * (its `bundleId` / `saleEventId` are what say which composites to touch).
 */
export async function refreshOwningComposites(ctx: MutationCtx, ad: Doc<"ads">): Promise<void> {
  if (ad.bundleId) await refreshCompositeDerived(ctx, { bundleId: ad.bundleId });
  if (ad.saleEventId) await refreshCompositeDerived(ctx, { saleEventId: ad.saleEventId });
}
