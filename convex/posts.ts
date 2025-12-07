import { mutation, query, action, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { getDescopeUserId } from "./lib/auth";
import { fromR2Reference, isR2Reference, r2 } from "./r2";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";

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
      throw new Error("Must be logged in to create an ad");
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
      throw new Error("Must be logged in to update an ad");
    }

    const existingAd = await ctx.db.get(args.adId);
    if (!existingAd) {
      throw new Error("Ad not found");
    }

    if (existingAd.userId !== userId) {
      throw new Error("You can only update your own ads");
    }

    await ctx.db.patch(args.adId, {
      title: args.title,
      description: args.description,
      extendedDescription: args.extendedDescription,
      price: args.price,
      location: args.location,
      categoryId: args.categoryId,
      images: args.images,
    });

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
      throw new Error("Must be logged in to delete an ad");
    }

    const existingAd = await ctx.db.get(args.adId);
    if (!existingAd) {
      throw new Error("Ad not found");
    }

    if (existingAd.userId !== userId) {
      throw new Error("You can only delete your own ads");
    }

    // Soft delete by marking as deleted
    await ctx.db.patch(args.adId, {
      isDeleted: true,
      isActive: false,
    });

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
      throw new Error("Must be logged in to toggle ad status");
    }

    const existingAd = await ctx.db.get(args.adId);
    if (!existingAd) {
      throw new Error("Ad not found");
    }

    if (existingAd.userId !== userId) {
      throw new Error("You can only modify your own ads");
    }

    const newStatus = !existingAd.isActive;
    await ctx.db.patch(args.adId, {
      isActive: newStatus,
    });

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
