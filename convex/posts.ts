import { mutation, query, action, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { getDescopeUserId } from "./lib/auth";
import { countUnreadForChat } from "./lib/unread";
import { fromR2Reference, isR2Reference, r2 } from "./r2";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { createError, logOperation } from "./lib/logger";
import { checkRateLimit, checkRateLimitDynamic, RATE_LIMITS } from "./lib/rateLimit";
import { detachAdFromBundle } from "./bundles";
import { readSettingValue } from "./appSettings";
import {
  FLAG_BOOST_TO_TOP,
  SETTING_BOOST_COOLDOWN_DAYS,
  SETTING_BOOST_DAILY_CAP,
  DEFAULT_BOOST_COOLDOWN_DAYS,
  DEFAULT_BOOST_DAILY_CAP,
  clampCooldownDays,
  clampDailyCap,
  MS_PER_DAY,
} from "./lib/boost";

/**
 * Creates a new flyer listing.
 * 
 * @requires Authentication - User must be logged in
 * @ratelimit 10 requests per hour
 * @validates Price required for "sale" and "both" listing types
 * @returns The ID of the newly created ad
 * @throws "Must be logged in" if user not authenticated
 * @throws "Price is required" if listing type requires price but none provided
 * @throws Rate limit error if user exceeds 10 creations per hour
 * 
 * @example
 * ```typescript
 * const adId = await ctx.runMutation(api.posts.createAd, {
 *   title: "iPhone 14 Pro",
 *   description: "Excellent condition",
 *   listingType: "sale",
 *   price: 800,
 *   location: "Sydney, NSW",
 *   categoryId: "abc123",
 *   images: ["r2:flyers/xxx/image1.webp"]
 * });
 * ```
 */
export const createAd = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    listingType: v.optional(v.union(v.literal("sale"), v.literal("exchange"), v.literal("both"))),
    price: v.optional(v.number()),
    exchangeDescription: v.optional(v.string()),
    location: v.string(),
    categoryId: v.id("categories"),
    images: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getDescopeUserId(ctx);
    if (!userId) {
      throw createError("Must be logged in to create a flyer", { operation: "createAd" });
    }

    // Rate limit: 10 flyer creations per hour
    await checkRateLimit(ctx, userId, "createAd");

    // Default to "sale" if not specified (backward compatibility)
    const listingType = args.listingType || "sale";

    // Validate price is provided for sale and both listing types
    if ((listingType === "sale" || listingType === "both") && (args.price === undefined || args.price === null)) {
      throw createError("Price is required for sale listings", { operation: "createAd", listingType });
    }

    const adId = await ctx.db.insert("ads", {
      title: args.title,
      description: args.description,
      listingType,
      price: args.price,
      exchangeDescription: args.exchangeDescription,
      location: args.location,
      categoryId: args.categoryId,
      images: args.images,
      userId,
      isActive: true,
      views: 0,
      bumpedAt: Date.now(), // Boost feed sort key — initialized to creation time.
      boostCount: 0,
    });

    logOperation("Flyer created", { adId, userId, categoryId: args.categoryId, listingType });
    return adId;
  },
});


/**
 * Updates an existing flyer listing.
 * 
 * @requires Authentication - User must be logged in and own the flyer
 * @ratelimit 30 requests per hour
 * @validates Price required for "sale" and "both" listing types
 * @sideEffects Tracks price history (previousPrice) when price is lowered
 * @returns The ID of the updated ad
 * @throws "Must be logged in" if user not authenticated
 * @throws "Flyer not found" if ad doesn't exist
 * @throws "You can only update your own flyers" if user doesn't own the ad
 * @throws "Price is required" if listing type requires price
 * @throws Rate limit error if user exceeds 30 updates per hour
 */
export const updateAd = mutation({
  args: {
    adId: v.id("ads"),
    title: v.string(),
    description: v.string(),
    listingType: v.optional(v.union(v.literal("sale"), v.literal("exchange"), v.literal("both"))),
    price: v.optional(v.number()),
    exchangeDescription: v.optional(v.string()),
    location: v.string(),
    categoryId: v.id("categories"),
    images: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getDescopeUserId(ctx);
    if (!userId) {
      throw createError("Must be logged in to update a flyer", { operation: "updateAd", adId: args.adId });
    }

    // Rate limit: 30 flyer updates per hour
    await checkRateLimit(ctx, userId, "updateAd");

    const existingAd = await ctx.db.get(args.adId);
    if (!existingAd) {
      throw createError("Flyer not found", { adId: args.adId, userId });
    }

    if (existingAd.userId !== userId) {
      throw createError("You can only update your own flyers", { adId: args.adId, userId, ownerId: existingAd.userId });
    }

    // Default to existing listingType, or "sale" for backward compatibility
    const listingType = args.listingType || existingAd.listingType || "sale";

    // Validate price is provided for sale and both listing types
    if ((listingType === "sale" || listingType === "both") && (args.price === undefined || args.price === null)) {
      throw createError("Price is required for sale listings", { operation: "updateAd", listingType });
    }

    // Handle price history logic - only for listings with prices
    let previousPrice = existingAd.previousPrice;
    if (args.price !== undefined && existingAd.price !== undefined && args.price !== existingAd.price) {
      // Price is being changed
      if (args.price < existingAd.price) {
        // Price is being lowered - save the old price
        previousPrice = existingAd.price;
      } else {
        // Price is being raised - clear previous price
        previousPrice = undefined;
      }
    }
    // If price unchanged or not applicable, keep previousPrice as is

    await ctx.db.patch(args.adId, {
      title: args.title,
      description: args.description,
      listingType,
      price: args.price,
      exchangeDescription: args.exchangeDescription,
      previousPrice,
      location: args.location,
      categoryId: args.categoryId,
      images: args.images,
    });

    logOperation("Flyer updated", { adId: args.adId, userId, listingType });
    return args.adId;
  },
});

/**
 * Boost ("push to top") — re-stamps an ad's `bumpedAt` to now, lifting it back to the
 * top of the newest-first feed. This is the flagship visibility action.
 *
 * Authoritative server-side gate (never trust the client):
 *   1. Auth — must be logged in.
 *   2. Feature flag `boostToTop` must be ENABLED — fail closed if the flag is off or
 *      missing, so the feature can ship dark and be flipped from the admin dashboard.
 *   3. Ad must exist and not be soft-deleted.
 *   4. Ownership — only the owner may boost.
 *   5. Eligibility — active, not sold, not a sale-event member, not bundled.
 *   6. Cooldown — `Date.now() - bumpedAt >= cooldown`, where the cooldown length is
 *      admin-tunable (`appSettings.boostCooldownDays`, default 7, clamped 1–30 on read).
 *   7. Per-user daily cap — admin-tunable (`appSettings.boostDailyCap`, default 3,
 *      clamped 1–20) enforced in-mutation via `checkRateLimitDynamic`. A single
 *      rate-limit row per boost; the static `RATE_LIMITS.boostAd` (20/day) is the hard
 *      backstop ceiling the clamp can never exceed. Convex transactions roll the row
 *      back on any later throw, so only SUCCESSFUL boosts consume budget.
 *
 * PRICING SEAM (folded former Phase 4): `boostCount` is recorded from day one so a
 * future "first boost free, then paid" rollout needs no migration. When pricing lands,
 * non-first boosts route through a checkout flow here — mirroring the STUB pattern in
 * `saleEvents.ts` purchaseAddon. Build NO payments table / Stripe / purchase UI now.
 *
 * @requires Authentication + ownership
 * @throws "Boost is not available right now" if the feature flag is disabled
 * @throws cooldown / eligibility / rate-limit errors naming the reason
 */
export const boostAd = mutation({
  args: { adId: v.id("ads") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getDescopeUserId(ctx);
    if (!userId) {
      throw createError("Must be logged in to boost a flyer", { operation: "boostAd", adId: args.adId });
    }

    // Feature flag gate — fail closed (off or missing → rejected).
    const flag = await ctx.db
      .query("featureFlags")
      .withIndex("by_key", (q) => q.eq("key", FLAG_BOOST_TO_TOP))
      .first();
    if (!flag?.enabled) {
      throw createError("Boost is not available right now", { operation: "boostAd", adId: args.adId });
    }

    const existingAd = await ctx.db.get(args.adId);
    if (!existingAd || existingAd.isDeleted) {
      throw createError("Flyer not found", { adId: args.adId, userId });
    }

    if (existingAd.userId !== userId) {
      throw createError("You can only boost your own flyers", { adId: args.adId, userId, ownerId: existingAd.userId });
    }

    // Eligibility (mirrors the dashboard's client-side gate — display only there; this
    // is the authority). Sale-event members are permanently ineligible in v1 because
    // saleEventId is never cleared today (documented accepted limitation).
    if (!existingAd.isActive) {
      throw createError("This flyer is inactive and can't be boosted", { adId: args.adId, userId });
    }
    if (existingAd.isSold) {
      throw createError("Sold flyers can't be boosted", { adId: args.adId, userId });
    }
    if (existingAd.saleEventId) {
      throw createError("Sale items can't be boosted", { adId: args.adId, userId });
    }
    if (existingAd.bundleId) {
      throw createError("Bundled flyers can't be boosted", { adId: args.adId, userId });
    }

    // Cooldown — admin-tunable, clamped on read; falls back to the default when unset.
    const cooldownRaw = await readSettingValue(ctx, SETTING_BOOST_COOLDOWN_DAYS);
    const cooldownDays = clampCooldownDays(cooldownRaw ?? DEFAULT_BOOST_COOLDOWN_DAYS);
    const cooldownMs = cooldownDays * MS_PER_DAY;
    const elapsed = Date.now() - existingAd.bumpedAt;
    if (elapsed < cooldownMs) {
      const waitDays = Math.ceil((cooldownMs - elapsed) / MS_PER_DAY);
      throw createError(
        `You can boost this flyer again in ${waitDays} day${waitDays === 1 ? "" : "s"}`,
        { adId: args.adId, userId, waitDays }
      );
    }

    // Per-user daily cap — admin-tunable, clamped to ≤ the static backstop ceiling so a
    // single rate-limit row enforces both. Placed last (after all cheaper checks) so
    // the row is only inserted for boosts that otherwise pass.
    const capRaw = await readSettingValue(ctx, SETTING_BOOST_DAILY_CAP);
    const dailyCap = clampDailyCap(capRaw ?? DEFAULT_BOOST_DAILY_CAP);
    await checkRateLimitDynamic(ctx, userId, "boostAd", dailyCap, RATE_LIMITS.boostAd.windowMs);

    // Pricing seam: recorded, allowed regardless for the free v1 (see docblock).
    const nextBoostCount = (existingAd.boostCount ?? 0) + 1;

    await ctx.db.patch(args.adId, {
      bumpedAt: Date.now(),
      boostCount: nextBoostCount,
    });

    logOperation("Flyer boosted", { adId: args.adId, userId, boostCount: nextBoostCount });
    return null;
  },
});

/**
 * Soft-deletes a flyer (marks as deleted, doesn't remove from database).
 * 
 * @requires Authentication - User must be logged in and own the flyer
 * @ratelimit 20 requests per hour
 * @pattern Soft delete - sets isDeleted=true, isActive=false
 * @note Images remain in R2 for potential restoration
 * @returns The ID of the deleted ad
 * @throws "Must be logged in" if user not authenticated
 * @throws "Flyer not found" if ad doesn't exist
 * @throws "You can only delete your own flyers" if user doesn't own the ad
 */
export const deleteAd = mutation({
  args: {
    adId: v.id("ads"),
  },
  handler: async (ctx, args) => {
    const userId = await getDescopeUserId(ctx);
    if (!userId) {
      throw createError("Must be logged in to delete a flyer", { operation: "deleteAd", adId: args.adId });
    }

    // Rate limit: 20 flyer deletions per hour
    await checkRateLimit(ctx, userId, "deleteAd");

    const existingAd = await ctx.db.get(args.adId);
    if (!existingAd) {
      throw createError("Flyer not found", { adId: args.adId, userId });
    }

    if (existingAd.userId !== userId) {
      throw createError("You can only delete your own flyers", { adId: args.adId, userId, ownerId: existingAd.userId });
    }

    // If this ad is in a standalone bundle, detach it first (moves the bundle to
    // partial, or cancels it if too few remain). No-op for Sale-scoped bundles.
    await detachAdFromBundle(ctx, existingAd, "deleted");

    // Soft delete by marking as deleted
    // Images remain in R2 until the retention-policy cleanup job purges them (see convex/imageCleanup.ts)
    await ctx.db.patch(args.adId, {
      isDeleted: true,
      isActive: false,
      deletedAt: Date.now(),
    });

    logOperation("Flyer soft-deleted", { adId: args.adId, userId });
    return args.adId;
  },
});

export const toggleAdStatus = mutation({
  args: {
    adId: v.id("ads"),
  },
  handler: async (ctx, args) => {
    const userId = await getDescopeUserId(ctx);
    if (!userId) {
      throw createError("Must be logged in to toggle flyer status", { operation: "toggleAdStatus", adId: args.adId });
    }

    const existingAd = await ctx.db.get(args.adId);
    if (!existingAd) {
      throw createError("Flyer not found", { adId: args.adId, userId });
    }

    if (existingAd.userId !== userId) {
      throw createError("You can only modify your own flyers", { adId: args.adId, userId, ownerId: existingAd.userId });
    }

    const newStatus = !existingAd.isActive;
    await ctx.db.patch(args.adId, {
      isActive: newStatus,
    });

    logOperation("Flyer status toggled", { adId: args.adId, userId, newStatus });
    return { adId: args.adId, isActive: newStatus };
  },
});

export const getUserAds = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getDescopeUserId(ctx);
    if (!userId) {
      return [];
    }

    const ads = await ctx.db
      .query("ads")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.neq(q.field("isDeleted"), true))
      .collect();

    return ads;
  },
});

export const getSellerChats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getDescopeUserId(ctx);
    if (!userId) {
      return [];
    }

    const chats = await ctx.db
      .query("chats")
      .withIndex("by_seller", (q) => q.eq("sellerId", userId))
      .filter((q) => q.neq(q.field("archivedBySeller"), true))
      .filter((q) => q.neq(q.field("deletedBySeller"), true))
      .collect();

    // Get additional info for each chat
    const chatsWithInfo = await Promise.all(
      chats.map(async (chat) => {
        // Sale/Bundle threads set saleEventId/bundleId and leave adId undefined.
        // Every read here is independent — resolve them concurrently instead of
        // lengthening the per-chat chain each time a thread kind is added.
        const [ad, sale, bundle, buyer, latestMessage, unreadCount] = await Promise.all([
          chat.adId ? ctx.db.get(chat.adId) : null,
          chat.saleEventId ? ctx.db.get(chat.saleEventId) : null,
          chat.bundleId ? ctx.db.get(chat.bundleId) : null,
          ctx.db.get(chat.buyerId),
          // Latest message for the inbox snippet (same pattern as messages.getAdChats)
          ctx.db
            .query("messages")
            .withIndex("by_chat", (q) => q.eq("chatId", chat._id))
            .order("desc")
            .first(),
          countUnreadForChat(ctx, chat, userId, "seller"),
        ]);

        return {
          ...chat,
          ad,
          sale: sale ? { _id: sale._id, title: sale.title, slug: sale.slug ?? null } : null,
          bundle: bundle ? { _id: bundle._id, label: bundle.label, status: bundle.status ?? "active" } : null,
          buyer: buyer ? {
            ...buyer,
            averageRating: buyer.averageRating || 0,
            ratingCount: buyer.ratingCount || 0,
          } : null,
          latestMessage,
          unreadCount,
        };
      })
    );

    return chatsWithInfo.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
  },
});

export const getBuyerChats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getDescopeUserId(ctx);
    if (!userId) {
      return [];
    }

    const chats = await ctx.db
      .query("chats")
      .withIndex("by_buyer", (q) => q.eq("buyerId", userId))
      .filter((q) => q.neq(q.field("archivedByBuyer"), true))
      .filter((q) => q.neq(q.field("deletedByBuyer"), true))
      .collect();

    // Get additional info for each chat
    const chatsWithInfo = await Promise.all(
      chats.map(async (chat) => {
        // Same concurrent-hydration pattern as getSellerChats above.
        const [ad, sale, bundle, seller, latestMessage, unreadCount] = await Promise.all([
          chat.adId ? ctx.db.get(chat.adId) : null,
          chat.saleEventId ? ctx.db.get(chat.saleEventId) : null,
          chat.bundleId ? ctx.db.get(chat.bundleId) : null,
          ctx.db.get(chat.sellerId),
          ctx.db
            .query("messages")
            .withIndex("by_chat", (q) => q.eq("chatId", chat._id))
            .order("desc")
            .first(),
          countUnreadForChat(ctx, chat, userId, "buyer"),
        ]);

        return {
          ...chat,
          ad,
          sale: sale ? { _id: sale._id, title: sale.title, slug: sale.slug ?? null } : null,
          bundle: bundle ? { _id: bundle._id, label: bundle.label, status: bundle.status ?? "active" } : null,
          seller: seller ? {
            ...seller,
            averageRating: seller.averageRating || 0,
            ratingCount: seller.ratingCount || 0,
          } : null,
          latestMessage,
          unreadCount,
        };
      })
    );

    return chatsWithInfo.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
  },
});

export const getImageUrl = query({
  args: {
    imageRef: v.string(),
  },
  handler: async (ctx, args) => {
    // Handle external URLs (e.g., Unsplash) - return as-is
    if (args.imageRef.startsWith('http://') || args.imageRef.startsWith('https://')) {
      return args.imageRef;
    }

    // Handle base64-encoded images (data URLs) - return as-is
    if (args.imageRef.startsWith('data:')) {
      return args.imageRef;
    }

    // Handle R2 references with r2: prefix
    if (isR2Reference(args.imageRef)) {
      const key = fromR2Reference(args.imageRef);
      return await r2.getUrl(key, {
        expiresIn: 60 * 60 * 24, // 24 hours
      });
    }

    // Handle legacy R2 keys (without r2: prefix) - check for common patterns
    if (args.imageRef.includes('/') &&
      (args.imageRef.startsWith('ad/') ||
        args.imageRef.startsWith('flyers/') ||
        args.imageRef.startsWith('profiles/'))) {
      return await r2.getUrl(args.imageRef, {
        expiresIn: 60 * 60 * 24, // 24 hours
      });
    }

    // Legacy: Handle old _storage IDs (UUIDs)
    return await ctx.storage.getUrl(args.imageRef as any);
  },
});
