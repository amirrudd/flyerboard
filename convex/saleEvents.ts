import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getDescopeUserId } from "./lib/auth";
import { createError, logOperation } from "./lib/logger";
import { checkRateLimit } from "./lib/rateLimit";
import type { Id, Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

/**
 * Moving Sale Mode backend.
 *
 * A `saleEvent` groups many ads into one shareable, time-boxed sale. The seller
 * builds the whole thing for free (create event → bulk upload → review → bundles
 * → private preview); the public page only goes live once `isPaid` is set.
 *
 * Gate-on-distribution: every step here works in the free tier. `publishSaleEvent`
 * is the paywall seam — see its doc comment.
 */

// v2: the mode is free with unlimited items. The only ceiling is an anti-abuse
// limit enforced server-side in `addSaleItems` (ABUSE_CEILING).

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────

function slugifyPart(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
}

/** 4-char collision-suffix. Math.random is allowed in Convex mutations. */
function randomSuffix(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < 4; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

/**
 * Mint a permanent, human-readable, collision-safe slug:
 *   {first-name}-sale-{suburb}-{4-char-uid}
 * e.g. "amirs-sale-richmond-k7p2"
 */
async function mintSlug(
  ctx: MutationCtx,
  firstName: string,
  suburb: string
): Promise<string> {
  const namePart = slugifyPart(firstName) || "my";
  // Drop the state suffix ("Richmond, VIC" → "richmond") for a cleaner slug.
  const suburbPart = slugifyPart(suburb.split(",")[0]) || "sale";
  const base = `${namePart}-sale-${suburbPart}`;

  // Try a few suffixes; collisions are astronomically unlikely but cheap to guard.
  for (let attempt = 0; attempt < 6; attempt++) {
    const candidate = `${base}-${randomSuffix()}`;
    const existing = await ctx.db
      .query("saleEvents")
      .withIndex("by_slug", (q) => q.eq("slug", candidate))
      .first();
    if (!existing) return candidate;
  }
  // Fallback: long suffix, effectively unique.
  return `${base}-${randomSuffix()}${randomSuffix()}`;
}

/** Pick a sensible default category for AI-stub drafts (prefers "Other"/"Misc"). */
async function getDefaultCategoryId(
  ctx: QueryCtx | MutationCtx
): Promise<Id<"categories">> {
  const categories = await ctx.db.query("categories").collect();
  if (categories.length === 0) {
    throw createError("No categories configured", { operation: "addSaleItems" });
  }
  const preferred = categories.find((c) =>
    /other|misc|general/i.test(c.slug) || /other|misc|general/i.test(c.name)
  );
  return (preferred ?? categories[0])._id;
}

/** Load a sale event and assert the caller owns it. Returns the event. */
async function requireOwnedSale(
  ctx: MutationCtx,
  saleEventId: Id<"saleEvents">,
  operation: string
): Promise<{ userId: Id<"users">; sale: Doc<"saleEvents"> }> {
  const userId = await getDescopeUserId(ctx);
  if (!userId) {
    throw createError("Must be logged in", { operation });
  }
  const sale = await ctx.db.get(saleEventId);
  if (!sale) {
    throw createError("Sale not found", { operation, saleEventId });
  }
  if (sale.userId !== userId) {
    throw createError("You can only modify your own sale", {
      operation,
      saleEventId,
      userId,
      ownerId: sale.userId,
    });
  }
  return { userId, sale };
}

/** Non-deleted ads belonging to a sale event. */
async function saleItems(
  ctx: QueryCtx | MutationCtx,
  saleEventId: Id<"saleEvents">
): Promise<Doc<"ads">[]> {
  const items = await ctx.db
    .query("ads")
    .withIndex("by_sale_event", (q) => q.eq("saleEventId", saleEventId))
    .filter((q) => q.neq(q.field("isDeleted"), true))
    .collect();
  return items;
}

// ──────────────────────────────────────────────────────────────────────────
// Mutations — seller flow
// ──────────────────────────────────────────────────────────────────────────

/** Step 2: create the sale event shell (draft, free tier). */
export const createSaleEvent = mutation({
  args: {
    title: v.string(),
    suburb: v.string(),
    note: v.optional(v.string()),
    pickupWindowStart: v.number(),
    pickupWindowEnd: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getDescopeUserId(ctx);
    if (!userId) {
      throw createError("Must be logged in to start a sale", {
        operation: "createSaleEvent",
      });
    }
    await checkRateLimit(ctx, userId, "createSaleEvent");

    if (args.pickupWindowEnd <= args.pickupWindowStart) {
      throw createError("Pickup window end must be after the start", {
        operation: "createSaleEvent",
      });
    }

    const saleEventId = await ctx.db.insert("saleEvents", {
      userId,
      title: args.title.trim() || "My Moving Sale",
      suburb: args.suburb.trim(),
      note: args.note?.trim() || undefined,
      pickupWindowStart: args.pickupWindowStart,
      pickupWindowEnd: args.pickupWindowEnd,
      status: "draft",
      createdAt: Date.now(),
    });

    logOperation("Sale event created", { saleEventId, userId });
    return saleEventId;
  },
});

/** Edit sale-level fields (setup screen / dashboard). */
export const updateSaleEvent = mutation({
  args: {
    saleEventId: v.id("saleEvents"),
    title: v.optional(v.string()),
    suburb: v.optional(v.string()),
    note: v.optional(v.string()),
    pickupWindowStart: v.optional(v.number()),
    pickupWindowEnd: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { sale } = await requireOwnedSale(ctx, args.saleEventId, "updateSaleEvent");

    const start = args.pickupWindowStart ?? sale.pickupWindowStart;
    const end = args.pickupWindowEnd ?? sale.pickupWindowEnd;
    if (end <= start) {
      throw createError("Pickup window end must be after the start", {
        operation: "updateSaleEvent",
      });
    }

    await ctx.db.patch(args.saleEventId, {
      ...(args.title !== undefined ? { title: args.title.trim() || sale.title } : {}),
      ...(args.suburb !== undefined ? { suburb: args.suburb.trim() } : {}),
      ...(args.note !== undefined ? { note: args.note.trim() || undefined } : {}),
      pickupWindowStart: start,
      pickupWindowEnd: end,
    });
    return args.saleEventId;
  },
});

/**
 * Step 3: bulk-add items from already-uploaded photos. Each item becomes a draft
 * ad (isActive=false until the sale is published). Title/price/condition start as
 * AI-stub defaults and are refined in batch review.
 *
 * Images must already be uploaded via `upload_urls.generateListingUploadUrl`
 * (pass the saleEventId as the postId so they group under flyers/{saleEventId}/).
 */
export const addSaleItems = mutation({
  args: {
    saleEventId: v.id("saleEvents"),
    items: v.array(
      v.object({
        imageKey: v.string(), // r2: reference returned by the upload helper
        title: v.optional(v.string()),
        price: v.optional(v.number()),
        condition: v.optional(v.string()),
        categoryId: v.optional(v.id("categories")),
      })
    ),
  },
  handler: async (ctx, args) => {
    const { userId, sale } = await requireOwnedSale(
      ctx,
      args.saleEventId,
      "addSaleItems"
    );
    await checkRateLimit(ctx, userId, "addSaleItems");

    if (args.items.length === 0) return [];

    // v2: the mode is free — no tier cap. Manual listing is unlimited; the only
    // limit is a high abuse ceiling.
    const existing = await saleItems(ctx, args.saleEventId);
    const ABUSE_CEILING = 100;
    if (existing.length + args.items.length > ABUSE_CEILING) {
      throw createError(`A single sale can hold up to ${ABUSE_CEILING} items.`, {
        operation: "addSaleItems",
        existing: existing.length,
        adding: args.items.length,
      });
    }

    const defaultCategoryId = await getDefaultCategoryId(ctx);

    const createdIds: Id<"ads">[] = [];
    for (let i = 0; i < args.items.length; i++) {
      const item = args.items[i];
      const adId = await ctx.db.insert("ads", {
        title: item.title?.trim() || `Item ${existing.length + i + 1}`,
        description: "",
        listingType: "sale",
        price: item.price,
        location: sale.suburb,
        categoryId: item.categoryId ?? defaultCategoryId,
        images: [item.imageKey],
        userId,
        isActive: false, // draft — goes live on publish
        isSold: false,
        saleEventId: args.saleEventId,
        condition: item.condition,
        views: 0,
      });
      createdIds.push(adId);
    }

    logOperation("Sale items added", {
      saleEventId: args.saleEventId,
      count: createdIds.length,
    });
    return createdIds;
  },
});

/** Batch review: edit a single item's title/price/condition/category. */
export const updateSaleItem = mutation({
  args: {
    adId: v.id("ads"),
    title: v.optional(v.string()),
    price: v.optional(v.number()),
    condition: v.optional(v.string()),
    categoryId: v.optional(v.id("categories")),
  },
  handler: async (ctx, args) => {
    const userId = await getDescopeUserId(ctx);
    if (!userId) {
      throw createError("Must be logged in", { operation: "updateSaleItem" });
    }
    const ad = await ctx.db.get(args.adId);
    if (!ad || !ad.saleEventId) {
      throw createError("Sale item not found", { operation: "updateSaleItem", adId: args.adId });
    }
    if (ad.userId !== userId) {
      throw createError("You can only edit your own items", {
        operation: "updateSaleItem",
        adId: args.adId,
      });
    }
    await ctx.db.patch(args.adId, {
      ...(args.title !== undefined ? { title: args.title.trim() || ad.title } : {}),
      ...(args.price !== undefined ? { price: args.price } : {}),
      ...(args.condition !== undefined ? { condition: args.condition } : {}),
      ...(args.categoryId !== undefined ? { categoryId: args.categoryId } : {}),
    });
    return args.adId;
  },
});

/** Remove an item from the sale entirely (soft delete the ad). */
export const removeSaleItem = mutation({
  args: { adId: v.id("ads") },
  handler: async (ctx, args) => {
    const userId = await getDescopeUserId(ctx);
    if (!userId) {
      throw createError("Must be logged in", { operation: "removeSaleItem" });
    }
    const ad = await ctx.db.get(args.adId);
    if (!ad || !ad.saleEventId) {
      throw createError("Sale item not found", { operation: "removeSaleItem", adId: args.adId });
    }
    if (ad.userId !== userId) {
      throw createError("You can only remove your own items", {
        operation: "removeSaleItem",
        adId: args.adId,
      });
    }
    await ctx.db.patch(args.adId, { isDeleted: true, isActive: false });
    return args.adId;
  },
});

/**
 * Mark an item sold / unsold. Sold items stay visible (greyed) on the sale page —
 * this is `isSold`, deliberately NOT `isDeleted`, to avoid the "dead sale" trap.
 */
export const setItemSold = mutation({
  args: { adId: v.id("ads"), isSold: v.boolean() },
  handler: async (ctx, args) => {
    const userId = await getDescopeUserId(ctx);
    if (!userId) {
      throw createError("Must be logged in", { operation: "setItemSold" });
    }
    const ad = await ctx.db.get(args.adId);
    if (!ad || !ad.saleEventId) {
      throw createError("Sale item not found", { operation: "setItemSold", adId: args.adId });
    }
    if (ad.userId !== userId) {
      throw createError("You can only update your own items", {
        operation: "setItemSold",
        adId: args.adId,
      });
    }
    await ctx.db.patch(args.adId, { isSold: args.isSold });
    return args.adId;
  },
});

/**
 * Replace the sale's bundles. Clears existing bundles (and the bundleId on their
 * ads) then inserts the new set, stamping bundleId back onto member ads.
 */
export const setBundles = mutation({
  args: {
    saleEventId: v.id("saleEvents"),
    bundles: v.array(
      v.object({
        label: v.string(),
        bundlePrice: v.number(),
        adIds: v.array(v.id("ads")),
      })
    ),
  },
  handler: async (ctx, args) => {
    await requireOwnedSale(ctx, args.saleEventId, "setBundles");

    // Clear existing bundles + member references.
    const existing = await ctx.db
      .query("saleBundles")
      .withIndex("by_sale_event", (q) => q.eq("saleEventId", args.saleEventId))
      .collect();
    for (const bundle of existing) {
      for (const adId of bundle.adIds) {
        const ad = await ctx.db.get(adId);
        if (ad?.bundleId === bundle._id) {
          await ctx.db.patch(adId, { bundleId: undefined });
        }
      }
      await ctx.db.delete(bundle._id);
    }

    // Only allow ads that belong to this sale into bundles.
    const validIds = new Set((await saleItems(ctx, args.saleEventId)).map((a) => a._id));

    const created: Id<"saleBundles">[] = [];
    for (const bundle of args.bundles) {
      const adIds = bundle.adIds.filter((id) => validIds.has(id));
      if (adIds.length < 2) continue; // a bundle needs at least two items
      const bundleId = await ctx.db.insert("saleBundles", {
        saleEventId: args.saleEventId,
        label: bundle.label.trim() || "Bundle",
        bundlePrice: bundle.bundlePrice,
        adIds,
      });
      for (const adId of adIds) {
        await ctx.db.patch(adId, { bundleId });
      }
      created.push(bundleId);
    }
    return created;
  },
});

/**
 * Step 6: PUBLISH — free in v2. No payment gate.
 *
 * Publishing is the core free product: mint the permanent slug, flip status to
 * active, set an expiry past the pickup window, and activate all items so they go
 * live on the public page (and the main feed). Monetisation happens afterwards via
 * optional add-ons (see `purchaseAddon`), never as a gate on publishing.
 */
export const publishSaleEvent = mutation({
  args: { saleEventId: v.id("saleEvents") },
  handler: async (ctx, args) => {
    const { userId, sale } = await requireOwnedSale(
      ctx,
      args.saleEventId,
      "publishSaleEvent"
    );

    // Slug is minted once and never regenerated (printed flyers encode it).
    let slug = sale.slug;
    if (!slug) {
      const user = await ctx.db.get(userId);
      const firstName = (user?.name ?? user?.email ?? "my").split(/[\s@]/)[0];
      slug = await mintSlug(ctx, firstName, sale.suburb);
    }

    const EXPIRY_BUFFER_MS = 2 * 24 * 60 * 60 * 1000; // keep page up 2 days past pickup
    await ctx.db.patch(args.saleEventId, {
      slug,
      status: "active",
      expiresAt: sale.pickupWindowEnd + EXPIRY_BUFFER_MS,
    });

    // Activate all (non-deleted) items so they go live.
    for (const item of await saleItems(ctx, args.saleEventId)) {
      if (!item.isActive) {
        await ctx.db.patch(item._id, { isActive: true });
      }
    }

    logOperation("Sale event published (free)", { saleEventId: args.saleEventId, slug });
    return { slug };
  },
});

/**
 * Purchase an optional add-on for a published sale. STUB — real flow opens Stripe
 * Checkout per add-on; here the owner "buys" instantly so the gated capability
 * (flyer download / search pin / AI listing) unlocks for testing.
 *
 * Add-ons: "flyer" (QR + PDF), "pin" (7-day search pin), "ai" (AI bulk listing).
 */
export const purchaseAddon = mutation({
  args: {
    saleEventId: v.id("saleEvents"),
    addon: v.union(v.literal("flyer"), v.literal("pin"), v.literal("ai")),
  },
  handler: async (ctx, args) => {
    const { sale } = await requireOwnedSale(ctx, args.saleEventId, "purchaseAddon");
    const unlocked = new Set(sale.unlockedAddons ?? []);
    unlocked.add(args.addon);

    const patch: Record<string, unknown> = { unlockedAddons: Array.from(unlocked) };
    if (args.addon === "pin") {
      patch.pinnedUntil = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7-day search pin
    }
    await ctx.db.patch(args.saleEventId, patch);

    logOperation("Sale add-on purchased (stub)", { saleEventId: args.saleEventId, addon: args.addon });
    return { unlockedAddons: Array.from(unlocked) };
  },
});

// ──────────────────────────────────────────────────────────────────────────
// Queries
// ──────────────────────────────────────────────────────────────────────────

/** Dashboard "sales" tab: the caller's sale events with summary stats. */
export const getMySaleEvents = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getDescopeUserId(ctx);
    if (!userId) return [];

    const events = await ctx.db
      .query("saleEvents")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    return Promise.all(
      events
        .sort((a, b) => b.createdAt - a.createdAt)
        .map(async (event) => {
          const items = await saleItems(ctx, event._id);
          const sold = items.filter((i) => i.isSold).length;
          const totalValue = items.reduce((sum, i) => sum + (i.price ?? 0), 0);
          return {
            ...event,
            itemCount: items.length,
            soldCount: sold,
            availableCount: items.length - sold,
            totalValue,
            coverImage: items[0]?.images[0] ?? null,
          };
        })
    );
  },
});

/**
 * Owner-only editor/preview payload: the event plus all its items and bundles.
 * Powers the seller flow (resume) and the blurred paywall preview.
 */
export const getSaleEditor = query({
  args: { saleEventId: v.id("saleEvents") },
  handler: async (ctx, args) => {
    const userId = await getDescopeUserId(ctx);
    if (!userId) return null;
    const sale = await ctx.db.get(args.saleEventId);
    if (!sale || sale.userId !== userId) return null;

    const items = await saleItems(ctx, args.saleEventId);
    const bundles = await ctx.db
      .query("saleBundles")
      .withIndex("by_sale_event", (q) => q.eq("saleEventId", args.saleEventId))
      .collect();

    return { sale, items, bundles };
  },
});

/**
 * PUBLIC buyer page. No auth. Returns null unless the sale exists and is live.
 * v2: free — the page is gated on publish status, NOT payment.
 * Sold items are included (greyed client-side); deleted items are excluded.
 */
export const getSaleBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const sale = await ctx.db
      .query("saleEvents")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    // Live once published (active or ended). Drafts stay private.
    if (!sale || sale.status === "draft") return null;

    const items = await saleItems(ctx, sale._id);
    const bundles = await ctx.db
      .query("saleBundles")
      .withIndex("by_sale_event", (q) => q.eq("saleEventId", sale._id))
      .collect();

    // Categories present in this sale, for the filter bar (no empty pills).
    const categoryIds = Array.from(new Set(items.map((i) => i.categoryId)));
    const categories = (
      await Promise.all(categoryIds.map((id) => ctx.db.get(id)))
    ).filter((c): c is Doc<"categories"> => c !== null);

    const seller = await ctx.db.get(sale.userId);

    const soldCount = items.filter((i) => i.isSold).length;
    const totalValue = items.reduce((sum, i) => sum + (i.price ?? 0), 0);

    return {
      sale: {
        _id: sale._id,
        slug: sale.slug,
        title: sale.title,
        suburb: sale.suburb,
        note: sale.note,
        pickupWindowStart: sale.pickupWindowStart,
        pickupWindowEnd: sale.pickupWindowEnd,
        status: sale.status,
      },
      seller: seller
        ? { _id: seller._id, name: seller.name ?? null, image: seller.image ?? null }
        : null,
      items,
      bundles,
      categories,
      stats: {
        total: items.length,
        sold: soldCount,
        available: items.length - soldCount,
        totalValue,
        bundleCount: bundles.length,
      },
    };
  },
});

/**
 * Sale-context banner for the ad-detail page (v3.1). Returns null unless the ad
 * belongs to a published Sale. Feed sale items are NOT differentiated anymore —
 * discovery happens here, where the buyer is already interested.
 *
 * Provides the seller's title-cased first name, the summary sub-line data
 * (suburb · items · pickup · from $X), and the thumbnail strip: the current item
 * (dimmed client-side) + up to 3 other items + a "+N" remainder.
 */
export const getSaleBannerForAd = query({
  args: { adId: v.id("ads") },
  handler: async (ctx, args) => {
    const ad = await ctx.db.get(args.adId);
    if (!ad || !ad.saleEventId) return null;
    const sale = await ctx.db.get(ad.saleEventId);
    if (!sale || sale.status === "draft" || !sale.slug) return null;

    const items = await saleItems(ctx, sale._id);
    const others = items.filter((i) => i._id !== ad._id);
    const otherImages = others
      .filter((i) => i.images.length > 0)
      .slice(0, 3)
      .map((i) => i.images[0]);
    const prices = items.map((i) => i.price ?? 0).filter((p) => p > 0);

    const seller = await ctx.db.get(sale.userId);
    const rawFirst = (seller?.name ?? "Seller").trim().split(/\s+/)[0] || "Seller";
    const sellerFirstName = rawFirst.charAt(0).toUpperCase() + rawFirst.slice(1); // title-case

    return {
      slug: sale.slug,
      sellerFirstName,
      suburb: sale.suburb,
      pickupWindowStart: sale.pickupWindowStart,
      itemCount: items.length,
      availableCount: items.filter((i) => !i.isSold).length,
      minPrice: prices.length ? Math.min(...prices) : 0,
      currentImage: ad.images[0] ?? null,
      currentItemSold: Boolean(ad.isSold),
      otherImages,
      moreCount: Math.max(0, others.length - otherImages.length),
    };
  },
});

/**
 * Active sales rendered as ONE card inside the main date-sorted feed (v3 — there
 * is no separate "sale event" section). Each returns the data the in-grid Sale
 * card needs: a few cover thumbnails for the 2×2 image grid, the photo count (so
 * the card picks its degradation layout), total item count, and a min price.
 */
export const getActiveSales = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const now = Date.now();
    const sales = (
      await ctx.db
        .query("saleEvents")
        .withIndex("by_status", (q) => q.eq("status", "active"))
        .collect()
    ).filter((s) => s.slug && (!s.expiresAt || s.expiresAt > now));

    // Newest first — merged into the feed by createdAt; sort rule unchanged.
    sales.sort((a, b) => b.createdAt - a.createdAt);

    const limited = sales.slice(0, args.limit ?? 12);
    return Promise.all(
      limited.map(async (sale) => {
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
      })
    );
  },
});
