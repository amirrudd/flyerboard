import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getDescopeUserId } from "./lib/auth";
import { createError, logOperation } from "./lib/logger";
import { checkRateLimit } from "./lib/rateLimit";
import { readSettingValue } from "./appSettings";
import {
  SETTING_BUNDLE_MAX_ITEMS,
  DEFAULT_BUNDLE_MAX_ITEMS,
  clampAppSetting,
} from "./lib/appConfig";
import type { Id, Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

/**
 * Bundle Listing backend.
 *
 * A "bundle" groups a small, fixed number of the seller's own standalone ads at a
 * discounted package price. It reuses the `saleBundles` table that Moving Sale Mode
 * shipped (Sale-scoped bundle suggestions) — a standalone bundle simply leaves
 * `saleEventId` undefined. See ResearchLab/ideas/bundle-listing-design.md.
 *
 * Invariants held here (not in the validator):
 *   • An ad belongs to at most ONE bundle (`ads.bundleId` is singular).
 *   • `bundleId` and `saleEventId` are mutually exclusive on an ad.
 *   • A standalone bundle always has `sellerId` + `status` populated.
 */

// Item cap — a bundle holds between MIN and MAX ads. "N" in the design doc.
// MIN stays static (a bundle of <2 is definitionally not a bundle). MAX is
// admin-tunable via appSettings key `bundleMaxItems` (default/bounds in
// convex/lib/appConfig.ts); createBundle reads it with clamp + fallback.
export const BUNDLE_MIN_ITEMS = 2;

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────

/** Effective status of a bundle row (legacy Sale rows may lack the field). */
function bundleStatus(bundle: Doc<"saleBundles">): "active" | "partial" | "sold" | "cancelled" {
  return bundle.status ?? "active";
}

/** Owning user of a bundle: sellerId directly, or derived via the Sale event. */
async function bundleOwnerId(
  ctx: QueryCtx | MutationCtx,
  bundle: Doc<"saleBundles">
): Promise<Id<"users"> | undefined> {
  if (bundle.sellerId) return bundle.sellerId;
  if (!bundle.saleEventId) return undefined;
  const sale = await ctx.db.get(bundle.saleEventId);
  return sale?.userId;
}

/** Load a standalone bundle and assert the caller owns it. */
async function requireOwnedBundle(
  ctx: MutationCtx,
  bundleId: Id<"saleBundles">,
  operation: string
): Promise<{ userId: Id<"users">; bundle: Doc<"saleBundles"> }> {
  const userId = await getDescopeUserId(ctx);
  if (!userId) {
    throw createError("Must be logged in", { operation });
  }
  const bundle = await ctx.db.get(bundleId);
  if (!bundle || bundle.isDeleted) {
    throw createError("Bundle not found", { operation, bundleId });
  }
  const ownerId = await bundleOwnerId(ctx, bundle);
  if (ownerId !== userId) {
    throw createError("You can only modify your own bundle", { operation, bundleId, userId, ownerId });
  }
  return { userId, bundle };
}

/** Auto-name a bundle from its first couple of item titles ("Sofa + Dining table"). */
function autoLabel(titles: string[]): string {
  const clean = titles.map((t) => t.trim()).filter(Boolean);
  if (clean.length === 0) return "Bundle";
  if (clean.length <= 2) return clean.join(" + ");
  return `${clean[0]} + ${clean.length - 1} more`;
}

/** Sum of the individual list prices of a set of ads. Exported for feed.ts card hydration. */
export function separatelyTotal(items: Doc<"ads">[]): number {
  return items.reduce((sum, a) => sum + (a.price ?? 0), 0);
}

/** Savings math shared by every bundle payload (banner/dashboard/feed). Exported for feed.ts. */
export function computeSavings(total: number, bundlePrice: number): { savings: number; savingsPct: number } {
  const savings = Math.max(0, total - bundlePrice);
  return { savings, savingsPct: total > 0 ? Math.round((savings / total) * 100) : 0 };
}

/**
 * Resolve a bundle's `adIds` into live ad docs (concurrently), dropping deleted/
 * missing ones — optionally sold ones too (the feed card needs a real deal).
 * Exported for feed.ts card hydration.
 */
export async function hydrateBundleItems(
  ctx: QueryCtx | MutationCtx,
  adIds: Id<"ads">[],
  opts: { excludeSold?: boolean } = {}
): Promise<Doc<"ads">[]> {
  const ads = await Promise.all(adIds.map((id) => ctx.db.get(id)));
  return ads.filter(
    (a): a is Doc<"ads"> => a !== null && !a.isDeleted && !(opts.excludeSold && a.isSold)
  );
}

/** Clear `bundleId` (concurrently) on every ad in `adIds` that still points at `bundleId`. */
async function freeAdsFromBundle(
  ctx: MutationCtx,
  adIds: Id<"ads">[],
  bundleId: Id<"saleBundles">
): Promise<void> {
  const ads = await Promise.all(adIds.map((id) => ctx.db.get(id)));
  const toFree = ads.filter((ad): ad is Doc<"ads"> => ad !== null && ad.bundleId === bundleId);
  await Promise.all(toFree.map((ad) => ctx.db.patch(ad._id, { bundleId: undefined })));
}

/**
 * Detach an ad from its bundle when the ad leaves involuntarily (deleted or sold
 * individually). Removes the ad from `adIds`, clears its `bundleId`, and moves the
 * bundle to `partial` (deal gone, grouping remembered) — or `cancelled` if fewer
 * than the minimum remain. Shared with `posts.deleteAd`. No-op for Sale bundles.
 */
export async function detachAdFromBundle(
  ctx: MutationCtx,
  ad: Doc<"ads">,
  mode: "sold" | "deleted"
): Promise<void> {
  if (!ad.bundleId) return;
  const bundle = await ctx.db.get(ad.bundleId);
  // Only standalone bundles react here; Sale-scoped bundles are managed by setBundles.
  if (!bundle || bundle.saleEventId || bundle.isDeleted) return;
  if (bundleStatus(bundle) === "cancelled" || bundleStatus(bundle) === "sold") return;

  const remaining = bundle.adIds.filter((id) => id !== ad._id);
  await ctx.db.patch(ad._id, { bundleId: undefined });

  if (remaining.length < BUNDLE_MIN_ITEMS) {
    // Too few left to be a bundle — cancel it and free the survivors.
    await freeAdsFromBundle(ctx, remaining, bundle._id);
    await ctx.db.patch(bundle._id, { adIds: remaining, status: "cancelled" });
  } else {
    await ctx.db.patch(bundle._id, { adIds: remaining, status: "partial" });
  }
  logOperation("Ad detached from bundle", { adId: ad._id, bundleId: bundle._id, mode });
}

// ──────────────────────────────────────────────────────────────────────────
// Mutations
// ──────────────────────────────────────────────────────────────────────────

/**
 * Create a standalone bundle from N of the caller's own eligible ads.
 * Ads stay fully standalone (still searchable / individually buyable); they just
 * gain a `bundleId` and render the "available as a bundle" banner.
 */
export const createBundle = mutation({
  args: {
    adIds: v.array(v.id("ads")),
    bundlePrice: v.number(),
    label: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getDescopeUserId(ctx);
    if (!userId) {
      throw createError("Must be logged in", { operation: "createBundle" });
    }
    await checkRateLimit(ctx, userId, "createBundle");

    // De-dupe while preserving order.
    const adIds = Array.from(new Set(args.adIds));
    const rawMax = await readSettingValue(ctx, SETTING_BUNDLE_MAX_ITEMS);
    const maxItems =
      rawMax === null
        ? DEFAULT_BUNDLE_MAX_ITEMS
        : clampAppSetting(SETTING_BUNDLE_MAX_ITEMS, rawMax);
    if (adIds.length < BUNDLE_MIN_ITEMS || adIds.length > maxItems) {
      throw createError(
        `A bundle needs between ${BUNDLE_MIN_ITEMS} and ${maxItems} items`,
        { operation: "createBundle", count: adIds.length }
      );
    }
    if (!(args.bundlePrice > 0)) {
      throw createError("Bundle price must be greater than zero", {
        operation: "createBundle",
        bundlePrice: args.bundlePrice,
      });
    }

    // Validate every ad against the eligibility rule (ownership + mutual exclusivity).
    // Fetched concurrently; checked in order so error messages stay deterministic.
    const fetched = await Promise.all(adIds.map((adId) => ctx.db.get(adId)));
    const items: Doc<"ads">[] = [];
    for (let i = 0; i < adIds.length; i++) {
      const ad = fetched[i];
      const adId = adIds[i];
      if (!ad || ad.isDeleted) {
        throw createError("One of the selected items no longer exists", { operation: "createBundle", adId });
      }
      if (ad.userId !== userId) {
        throw createError("You can only bundle your own items", { operation: "createBundle", adId });
      }
      if (ad.isSold) {
        throw createError("A sold item can't be bundled", { operation: "createBundle", adId });
      }
      if (ad.listingType === "exchange") {
        // Bundles are sale-only: a trade-only item has no price, which would
        // silently corrupt the "vs $X separately" savings math.
        throw createError("A trade-only item can't be bundled — bundles need sale prices", {
          operation: "createBundle",
          adId,
        });
      }
      if (ad.bundleId) {
        throw createError("An item is already in another bundle", { operation: "createBundle", adId });
      }
      if (ad.saleEventId) {
        throw createError("An item in a moving sale can't be bundled", { operation: "createBundle", adId });
      }
      items.push(ad);
    }

    const label = (args.label?.trim() || autoLabel(items.map((i) => i.title))).slice(0, 80);

    const bundleId = await ctx.db.insert("saleBundles", {
      sellerId: userId,
      adIds,
      bundlePrice: args.bundlePrice,
      label,
      status: "active",
      bumpedAt: Date.now(), // unified-feed sort key
      // saleEventId intentionally omitted — standalone bundle.
    });
    for (const adId of adIds) {
      await ctx.db.patch(adId, { bundleId });
    }

    logOperation("Bundle created", { bundleId, userId, count: adIds.length });
    return bundleId;
  },
});

/** Adjust a bundle's package price. Allowed while active or partial. */
export const updateBundlePrice = mutation({
  args: { bundleId: v.id("saleBundles"), bundlePrice: v.number() },
  handler: async (ctx, args) => {
    const { bundle } = await requireOwnedBundle(ctx, args.bundleId, "updateBundlePrice");
    if (bundleStatus(bundle) === "sold" || bundleStatus(bundle) === "cancelled") {
      throw createError("This bundle can no longer be edited", { operation: "updateBundlePrice", bundleId: args.bundleId });
    }
    if (!(args.bundlePrice > 0)) {
      throw createError("Bundle price must be greater than zero", { operation: "updateBundlePrice" });
    }
    await ctx.db.patch(args.bundleId, { bundlePrice: args.bundlePrice });
    return args.bundleId;
  },
});

/**
 * Remove one item from a bundle (deliberate seller edit). If the remaining count
 * drops below the minimum, the bundle is cancelled and the survivors revert to
 * plain standalone ads.
 */
export const removeBundleItem = mutation({
  args: { bundleId: v.id("saleBundles"), adId: v.id("ads") },
  handler: async (ctx, args) => {
    const { bundle } = await requireOwnedBundle(ctx, args.bundleId, "removeBundleItem");
    if (bundleStatus(bundle) === "sold" || bundleStatus(bundle) === "cancelled") {
      throw createError("This bundle can no longer be edited", { operation: "removeBundleItem", bundleId: args.bundleId });
    }
    if (!bundle.adIds.includes(args.adId)) {
      throw createError("That item isn't in this bundle", { operation: "removeBundleItem", adId: args.adId });
    }

    const remaining = bundle.adIds.filter((id) => id !== args.adId);
    const removed = await ctx.db.get(args.adId);
    if (removed?.bundleId === bundle._id) {
      await ctx.db.patch(args.adId, { bundleId: undefined });
    }

    if (remaining.length < BUNDLE_MIN_ITEMS) {
      await freeAdsFromBundle(ctx, remaining, bundle._id);
      await ctx.db.patch(bundle._id, { adIds: remaining, status: "cancelled" });
      logOperation("Bundle cancelled (dropped below minimum)", { bundleId: bundle._id });
      return { status: "cancelled" as const };
    }
    await ctx.db.patch(bundle._id, { adIds: remaining });
    return { status: bundleStatus(bundle) };
  },
});

/** Break up a bundle: items revert to fully standalone listings. */
export const cancelBundle = mutation({
  args: { bundleId: v.id("saleBundles") },
  handler: async (ctx, args) => {
    const { bundle } = await requireOwnedBundle(ctx, args.bundleId, "cancelBundle");
    if (bundleStatus(bundle) === "sold") {
      throw createError("A sold bundle can't be cancelled", { operation: "cancelBundle", bundleId: args.bundleId });
    }
    await freeAdsFromBundle(ctx, bundle.adIds, bundle._id);
    await ctx.db.patch(bundle._id, { status: "cancelled" });
    logOperation("Bundle cancelled", { bundleId: bundle._id });
    return args.bundleId;
  },
});

/**
 * Sell the bundle as-is: every item marked sold atomically. If any item was
 * already sold individually (a race), the whole mutation throws and the caller
 * is left in the `partial` state instead — nothing is half-applied.
 */
export const markBundleSold = mutation({
  args: { bundleId: v.id("saleBundles") },
  handler: async (ctx, args) => {
    const { bundle } = await requireOwnedBundle(ctx, args.bundleId, "markBundleSold");
    if (bundleStatus(bundle) !== "active") {
      throw createError("Only an active bundle can be sold as a set", {
        operation: "markBundleSold",
        bundleId: args.bundleId,
        status: bundleStatus(bundle),
      });
    }
    // Assert first — no partial writes if one item already went. Fetched concurrently;
    // checked in order so the "already sold" error names the same item deterministically.
    const fetched = await Promise.all(bundle.adIds.map((adId) => ctx.db.get(adId)));
    const items: Doc<"ads">[] = [];
    for (let i = 0; i < bundle.adIds.length; i++) {
      const ad = fetched[i];
      const adId = bundle.adIds[i];
      if (!ad || ad.isDeleted) {
        throw createError("An item in this bundle no longer exists", { operation: "markBundleSold", adId });
      }
      if (ad.isSold) {
        throw createError("An item in this bundle already sold — bundle deal is no longer available", {
          operation: "markBundleSold",
          adId,
        });
      }
      items.push(ad);
    }
    await Promise.all(items.map((ad) => ctx.db.patch(ad._id, { isSold: true })));
    await ctx.db.patch(bundle._id, { status: "sold" });
    logOperation("Bundle sold as a set", { bundleId: bundle._id, count: items.length });
    return args.bundleId;
  },
});

/**
 * Mark a single bundled item sold individually. The bundle deal is gone — status
 * moves to `partial`; the grouping is kept so the remaining item(s) can still show
 * "bundle no longer available, buy X separately". Setting `isSold:false` on the
 * last-sold item does not resurrect the deal (kept simple — cancel + recreate).
 */
export const markBundleItemSold = mutation({
  args: { adId: v.id("ads"), isSold: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const userId = await getDescopeUserId(ctx);
    if (!userId) throw createError("Must be logged in", { operation: "markBundleItemSold" });
    const ad = await ctx.db.get(args.adId);
    if (!ad || ad.isDeleted) throw createError("Item not found", { operation: "markBundleItemSold", adId: args.adId });
    if (ad.userId !== userId) throw createError("You can only update your own items", { operation: "markBundleItemSold", adId: args.adId });

    const sold = args.isSold ?? true;
    await ctx.db.patch(args.adId, { isSold: sold });

    if (sold && ad.bundleId) {
      const bundle = await ctx.db.get(ad.bundleId);
      if (bundle && !bundle.saleEventId && !bundle.isDeleted && bundleStatus(bundle) === "active") {
        await ctx.db.patch(bundle._id, { status: "partial" });
        logOperation("Bundle → partial (item sold individually)", { bundleId: bundle._id, adId: args.adId });
      }
    }
    return args.adId;
  },
});

// ──────────────────────────────────────────────────────────────────────────
// Queries
// ──────────────────────────────────────────────────────────────────────────

/**
 * Ad-detail "available as a bundle" banner payload. Only an ACTIVE standalone
 * bundle surfaces a banner — once it's partial/sold/cancelled the deal is gone
 * and the item reads as a plain listing (design: "banner removed"). Returns null
 * otherwise.
 */
export const getBundleBannerForAd = query({
  args: { adId: v.id("ads") },
  handler: async (ctx, args) => {
    const ad = await ctx.db.get(args.adId);
    if (!ad || !ad.bundleId) return null;
    const bundle = await ctx.db.get(ad.bundleId);
    if (!bundle || bundle.isDeleted || bundle.saleEventId) return null;
    if (bundleStatus(bundle) !== "active") return null;

    const items = await hydrateBundleItems(ctx, bundle.adIds);
    if (items.length < BUNDLE_MIN_ITEMS) return null;

    const total = separatelyTotal(items);
    const { savings, savingsPct } = computeSavings(total, bundle.bundlePrice);

    // Current item first (dimmed "you're here"), then the rest in bundle order.
    const ordered = [
      ...items.filter((i) => i._id === ad._id),
      ...items.filter((i) => i._id !== ad._id),
    ];

    return {
      bundleId: bundle._id,
      label: bundle.label,
      bundlePrice: bundle.bundlePrice,
      separatelyTotal: total,
      savings,
      savingsPct,
      itemCount: items.length,
      items: ordered.map((i) => ({
        adId: i._id,
        title: i.title,
        image: i.images[0] ?? null,
        price: i.price ?? 0,
        isCurrent: i._id === ad._id,
      })),
    };
  },
});

/**
 * Owner's standalone bundles for dashboard tags + management. Excludes deleted and
 * cancelled bundles (those no longer reference any ad). Newest first.
 */
export const getMyBundles = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getDescopeUserId(ctx);
    if (!userId) return [];

    const bundles = (
      await ctx.db
        .query("saleBundles")
        .withIndex("by_seller", (q) => q.eq("sellerId", userId))
        .collect()
    ).filter((b) => !b.isDeleted && !b.saleEventId && bundleStatus(b) !== "cancelled");

    bundles.sort((a, b) => b._creationTime - a._creationTime);

    return Promise.all(
      bundles.map(async (bundle) => {
        const items = await hydrateBundleItems(ctx, bundle.adIds);
        const total = separatelyTotal(items);
        const { savings } = computeSavings(total, bundle.bundlePrice);
        return {
          _id: bundle._id,
          label: bundle.label,
          status: bundleStatus(bundle),
          bundlePrice: bundle.bundlePrice,
          separatelyTotal: total,
          savings,
          adIds: bundle.adIds,
          items: items.map((i) => ({
            adId: i._id,
            title: i.title,
            image: i.images[0] ?? null,
            price: i.price ?? 0,
            isSold: Boolean(i.isSold),
          })),
        };
      })
    );
  },
});

/** Owner-only management payload for a single bundle. Null if not owner / missing. */
export const getBundle = query({
  args: { bundleId: v.id("saleBundles") },
  handler: async (ctx, args) => {
    const userId = await getDescopeUserId(ctx);
    if (!userId) return null;
    const bundle = await ctx.db.get(args.bundleId);
    if (!bundle || bundle.isDeleted || bundle.saleEventId) return null;
    if ((await bundleOwnerId(ctx, bundle)) !== userId) return null;

    const items = await hydrateBundleItems(ctx, bundle.adIds);
    const total = separatelyTotal(items);
    const { savings } = computeSavings(total, bundle.bundlePrice);
    return {
      _id: bundle._id,
      label: bundle.label,
      status: bundleStatus(bundle),
      bundlePrice: bundle.bundlePrice,
      separatelyTotal: total,
      savings,
      items: items.map((i) => ({
        adId: i._id,
        title: i.title,
        image: i.images[0] ?? null,
        price: i.price ?? 0,
        isSold: Boolean(i.isSold),
      })),
    };
  },
});

/**
 * The caller's own ads for the bundle picker grid, each flagged with whether it's
 * eligible and why not. Eligibility mirrors the design's rule exactly.
 */
export const getEligibleAdsForBundle = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getDescopeUserId(ctx);
    if (!userId) return [];

    const ads = (
      await ctx.db
        .query("ads")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .filter((q) => q.neq(q.field("isDeleted"), true))
        .collect()
    ).sort((a, b) => b._creationTime - a._creationTime);

    return ads.map((ad) => {
      let reason: string | null = null;
      if (ad.isSold) reason = "Sold";
      else if (ad.listingType === "exchange") reason = "Trade-only";
      else if (ad.bundleId) reason = "In another bundle";
      else if (ad.saleEventId) reason = "In a moving sale";
      return {
        _id: ad._id,
        title: ad.title,
        price: ad.price ?? 0,
        image: ad.images[0] ?? null,
        eligible: reason === null,
        reason,
      };
    });
  },
});

/**
 * Public payload for the bundle detail page (`/bundle/:id`) — the "Deal Ticket".
 * No auth required (mirrors the public sale page). Returns null for missing,
 * deleted, Sale-scoped, or cancelled bundles (cancelled bundles no longer
 * reference their ads, so there's nothing meaningful to render).
 *
 * `partial`/`sold` bundles still resolve: old links and message threads must
 * keep working, and the partial page converts the visit into the remaining
 * individually-available items.
 */
export const getPublicBundle = query({
  // v.string(), not v.id(): the arg comes straight from the /bundle/:id URL, so a
  // malformed share link must resolve to the friendly null state, not a thrown
  // ArgumentValidationError that trips the ErrorBoundary.
  args: { bundleId: v.string() },
  handler: async (ctx, args) => {
    const bundleId = ctx.db.normalizeId("saleBundles", args.bundleId);
    if (!bundleId) return null;
    const bundle = await ctx.db.get(bundleId);
    if (!bundle || bundle.isDeleted || bundle.saleEventId) return null;
    const status = bundleStatus(bundle);
    if (status === "cancelled") return null;

    // Keep sold members (rendered greyed with a SOLD pill) — only drop deleted ones.
    // Viewer identity is independent of the item fetches, so resolve it concurrently.
    const [items, viewerId] = await Promise.all([
      hydrateBundleItems(ctx, bundle.adIds),
      getDescopeUserId(ctx),
    ]);
    if (items.length === 0) return null;

    const total = separatelyTotal(items);
    const { savings, savingsPct } = computeSavings(total, bundle.bundlePrice);

    const ownerId = await bundleOwnerId(ctx, bundle);
    const seller = ownerId ? await ctx.db.get(ownerId) : null;

    return {
      _id: bundle._id,
      label: bundle.label,
      status,
      bundlePrice: bundle.bundlePrice,
      separatelyTotal: total,
      savings,
      savingsPct,
      location: items[0].location,
      isOwner: Boolean(viewerId && ownerId && viewerId === ownerId),
      seller: seller
        ? { _id: seller._id, name: seller.name, image: seller.image ?? null, isVerified: Boolean(seller.isVerified) }
        : null,
      items: items.map((i) => ({
        adId: i._id,
        title: i.title,
        image: i.images[0] ?? null,
        price: i.price ?? 0,
        isSold: Boolean(i.isSold),
      })),
    };
  },
});

// ──────────────────────────────────────────────────────────────────────────
// Saved bundles — bookmarking a whole Bundle (mirrors saleEvents.saveSaleEvent
// & friends). A bundle is a first-class entity (own detail page, own message
// thread), so saving bookmarks the bundle itself — not its individual items.
// ──────────────────────────────────────────────────────────────────────────

export const saveBundle = mutation({
  args: { bundleId: v.id("saleBundles") },
  handler: async (ctx, args) => {
    const userId = await getDescopeUserId(ctx);
    if (!userId) {
      throw createError("Must be logged in to save a bundle", {
        operation: "saveBundle",
        bundleId: args.bundleId,
      });
    }

    const bundle = await ctx.db.get(args.bundleId);
    if (!bundle || bundle.isDeleted || bundle.saleEventId) {
      throw createError("Bundle not found", { bundleId: args.bundleId, userId });
    }

    const existing = await ctx.db
      .query("savedBundles")
      .withIndex("by_user_and_bundle", (q) =>
        q.eq("userId", userId).eq("bundleId", args.bundleId)
      )
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
      return { saved: false };
    }
    await ctx.db.insert("savedBundles", { userId, bundleId: args.bundleId });
    return { saved: true };
  },
});

export const isBundleSaved = query({
  args: { bundleId: v.id("saleBundles") },
  handler: async (ctx, args) => {
    const userId = await getDescopeUserId(ctx);
    if (!userId) return false;

    const saved = await ctx.db
      .query("savedBundles")
      .withIndex("by_user_and_bundle", (q) =>
        q.eq("userId", userId).eq("bundleId", args.bundleId)
      )
      .unique();
    return !!saved;
  },
});

/** For the dashboard's "Saved" tab — every Bundle this user has bookmarked. */
export const getSavedBundles = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getDescopeUserId(ctx);
    if (!userId) return [];

    const saved = await ctx.db
      .query("savedBundles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    const withBundle = await Promise.all(
      saved.map(async (row) => {
        const bundle = await ctx.db.get(row.bundleId);
        if (!bundle || bundle.isDeleted || bundle.saleEventId) return null;
        const status = bundleStatus(bundle);
        if (status === "cancelled") return null;
        const items = await hydrateBundleItems(ctx, bundle.adIds);
        if (items.length === 0) return null;
        // Only what the Saved-tab card renders — mirrors getSavedSaleEvents' shape.
        return {
          _id: row._id,
          bundle: {
            _id: bundle._id,
            label: bundle.label,
            status,
            bundlePrice: bundle.bundlePrice,
            itemCount: items.length,
          },
        };
      })
    );

    return withBundle.filter((x): x is NonNullable<typeof x> => x !== null);
  },
});
