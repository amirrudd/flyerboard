import { mutation, query, action, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { getDescopeUserId } from "./lib/auth";
import { fromR2Reference, isR2Reference, r2 } from "./r2";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { createError, logOperation } from "./lib/logger";
import { checkRateLimit } from "./lib/rateLimit";

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

    // Soft delete by marking as deleted
    // Images remain in R2 for potential restoration
    // TODO: Implement cleanup job to hard delete flyers after 30+ days
    await ctx.db.patch(args.adId, {
      isDeleted: true,
      isActive: false,
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
      .collect();

    // Get additional info for each chat
    const chatsWithInfo = await Promise.all(
      chats.map(async (chat) => {
        const ad = await ctx.db.get(chat.adId);
        const buyer = await ctx.db.get(chat.buyerId);

        // Get unread message count
        const unreadCount = await ctx.db
          .query("messages")
          .withIndex("by_chat", (q) => q.eq("chatId", chat._id))
          .filter((q) =>
            q.and(
              q.neq(q.field("senderId"), userId),
              q.gt(q.field("timestamp"), chat.lastReadBySeller || 0)
            )
          )
          .collect();

        return {
          ...chat,
          ad,
          buyer: buyer ? {
            ...buyer,
            averageRating: buyer.averageRating || 0,
            ratingCount: buyer.ratingCount || 0,
          } : null,
          unreadCount: unreadCount.length,
        };
      })
    );

    return chatsWithInfo;
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
      .collect();

    // Get additional info for each chat
    const chatsWithInfo = await Promise.all(
      chats.map(async (chat) => {
        const ad = await ctx.db.get(chat.adId);
        const seller = await ctx.db.get(chat.sellerId);

        // Get unread message count
        const unreadCount = await ctx.db
          .query("messages")
          .withIndex("by_chat", (q) => q.eq("chatId", chat._id))
          .filter((q) =>
            q.and(
              q.neq(q.field("senderId"), userId),
              q.gt(q.field("timestamp"), chat.lastReadByBuyer || 0)
            )
          )
          .collect();

        return {
          ...chat,
          ad,
          seller: seller ? {
            ...seller,
            averageRating: seller.averageRating || 0,
            ratingCount: seller.ratingCount || 0,
          } : null,
          unreadCount: unreadCount.length,
        };
      })
    );

    return chatsWithInfo;
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
