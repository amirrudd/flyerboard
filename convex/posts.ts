import { mutation, query, action, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { getDescopeUserId } from "./lib/auth";
import { fromR2Reference, isR2Reference, r2 } from "./r2";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { createError, logOperation } from "./lib/logger";

export const createAd = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    extendedDescription: v.optional(v.string()),
    price: v.number(),
    location: v.string(),
    categoryId: v.id("categories"),
    images: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getDescopeUserId(ctx);
    if (!userId) {
      throw createError("Must be logged in to create a flyer", { operation: "createAd" });
    }

    const adId = await ctx.db.insert("ads", {
      title: args.title,
      description: args.description,
      extendedDescription: args.extendedDescription,
      price: args.price,
      location: args.location,
      categoryId: args.categoryId,
      images: args.images,
      userId,
      isActive: true,
      views: 0,
    });

    logOperation("Flyer created", { adId, userId, categoryId: args.categoryId });
    return adId;
  },
});

export const updateAd = mutation({
  args: {
    adId: v.id("ads"),
    title: v.string(),
    description: v.string(),
    extendedDescription: v.optional(v.string()),
    price: v.number(),
    location: v.string(),
    categoryId: v.id("categories"),
    images: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getDescopeUserId(ctx);
    if (!userId) {
      throw createError("Must be logged in to update a flyer", { operation: "updateAd", adId: args.adId });
    }

    const existingAd = await ctx.db.get(args.adId);
    if (!existingAd) {
      throw createError("Flyer not found", { adId: args.adId, userId });
    }

    if (existingAd.userId !== userId) {
      throw createError("You can only update your own flyers", { adId: args.adId, userId, ownerId: existingAd.userId });
    }

    // Handle price history logic
    let previousPrice = existingAd.previousPrice;
    if (args.price !== existingAd.price) {
      // Price is being changed
      if (args.price < existingAd.price) {
        // Price is being lowered - save the old price
        previousPrice = existingAd.price;
      } else {
        // Price is being raised - clear previous price
        previousPrice = undefined;
      }
    }
    // If price unchanged, keep previousPrice as is

    await ctx.db.patch(args.adId, {
      title: args.title,
      description: args.description,
      extendedDescription: args.extendedDescription,
      price: args.price,
      previousPrice,
      location: args.location,
      categoryId: args.categoryId,
      images: args.images,
    });

    logOperation("Flyer updated", { adId: args.adId, userId });
    return args.adId;
  },
});

export const deleteAd = mutation({
  args: {
    adId: v.id("ads"),
  },
  handler: async (ctx, args) => {
    const userId = await getDescopeUserId(ctx);
    if (!userId) {
      throw createError("Must be logged in to delete a flyer", { operation: "deleteAd", adId: args.adId });
    }

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
