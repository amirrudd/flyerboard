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

/** Free tier can list up to 10 items; the $9 pack unlocks 25. */
export const FREE_ITEM_CAP = 10;
export const PAID_ITEM_CAP = 25;

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
      itemCap: FREE_ITEM_CAP,
      isPaid: false,
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

    // Enforce the tier item cap.
    const existing = await saleItems(ctx, args.saleEventId);
    if (existing.length + args.items.length > sale.itemCap) {
      throw createError(
        `This sale is limited to ${sale.itemCap} items. ${sale.isPaid ? "" : "Upgrade to add more."}`,
        {
          operation: "addSaleItems",
          cap: sale.itemCap,
          existing: existing.length,
          adding: args.items.length,
        }
      );
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
 * Step 6: PUBLISH — the paywall seam.
 *
 * ⚠️ STUB: In production this is driven by a Stripe `checkout.session.completed`
 * webhook after the $9 Moving Sale Pack is paid. Until Stripe is wired, this
 * mutation stands in for "payment succeeded": the owner calls it directly and the
 * sale goes live. When Stripe lands, move the body into an internalMutation called
 * only from the verified webhook and have the client open Checkout instead.
 *
 * On publish: mint the permanent slug, flip to the paid tier (cap 25), set the
 * status active, set an expiry past the pickup window, and activate all items so
 * they appear on the public page (and the main feed).
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
      isPaid: true,
      status: "active",
      itemCap: PAID_ITEM_CAP,
      expiresAt: sale.pickupWindowEnd + EXPIRY_BUFFER_MS,
    });

    // Activate all (non-deleted) items so they go live.
    for (const item of await saleItems(ctx, args.saleEventId)) {
      if (!item.isActive) {
        await ctx.db.patch(item._id, { isActive: true });
      }
    }

    logOperation("Sale event published (STUB paywall)", { saleEventId: args.saleEventId, slug });
    return { slug };
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

    return { sale, items, bundles, itemCap: sale.itemCap };
  },
});

/**
 * PUBLIC buyer page. No auth. Returns null unless the sale exists and is paid/live.
 * Sold items are included (greyed client-side); deleted items are excluded.
 */
export const getSaleBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const sale = await ctx.db
      .query("saleEvents")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    // Gate the public page on payment.
    if (!sale || !sale.isPaid) return null;

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
