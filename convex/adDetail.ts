import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const getAdById = query({
  args: { adId: v.id("ads") },
  handler: async (ctx, args) => {
    const ad = await ctx.db.get(args.adId);

    // Return null if ad is deleted or doesn't exist
    if (!ad || ad.isDeleted) {
      return null;
    }

    // Get seller information
    const seller = await ctx.db.get(ad.userId);

    return {
      ...ad,
      seller: seller ? {
        name: seller.name,
        email: seller.email,
        averageRating: seller.averageRating || 0,
        ratingCount: seller.ratingCount || 0,
        image: seller.image,
      } : null,
    };
  },
});

export const incrementViews = mutation({
  args: { adId: v.id("ads") },
  handler: async (ctx, args) => {
    const ad = await ctx.db.get(args.adId);
    if (!ad || ad.isDeleted) {
      throw new Error("Ad not found");
    }

    await ctx.db.patch(args.adId, {
      views: ad.views + 1,
    });

    return { success: true };
  },
});

export const saveAd = mutation({
  args: { adId: v.id("ads") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Must be logged in to save ads");
    }

    // Check if ad exists and is not deleted
    const ad = await ctx.db.get(args.adId);
    if (!ad || ad.isDeleted) {
      throw new Error("Ad not found");
    }

    // Check if already saved
    const existing = await ctx.db
      .query("savedAds")
      .withIndex("by_user_and_ad", (q) =>
        q.eq("userId", userId).eq("adId", args.adId)
      )
      .unique();

    if (existing) {
      // Remove from saved
      await ctx.db.delete(existing._id);
      return { saved: false };
    } else {
      // Add to saved
      await ctx.db.insert("savedAds", {
        userId,
        adId: args.adId,
      });
      return { saved: true };
    }
  },
});

export const isAdSaved = query({
  args: { adId: v.id("ads") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return false;
    }

    const saved = await ctx.db
      .query("savedAds")
      .withIndex("by_user_and_ad", (q) =>
        q.eq("userId", userId).eq("adId", args.adId)
      )
      .unique();

    return !!saved;
  },
});

export const getOrCreateChat = mutation({
  args: { adId: v.id("ads") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Must be logged in to chat");
    }

    const ad = await ctx.db.get(args.adId);
    if (!ad || ad.isDeleted) {
      throw new Error("Ad not found");
    }

    if (ad.userId === userId) {
      throw new Error("Cannot chat with yourself");
    }

    // Check if chat already exists
    const existingChat = await ctx.db
      .query("chats")
      .withIndex("by_ad_and_buyer", (q) =>
        q.eq("adId", args.adId).eq("buyerId", userId)
      )
      .unique();

    if (existingChat) {
      return existingChat._id;
    }

    // Create new chat
    const chatId = await ctx.db.insert("chats", {
      adId: args.adId,
      buyerId: userId,
      sellerId: ad.userId,
      lastMessageAt: Date.now(),
    });

    return chatId;
  },
});

export const sendMessage = mutation({
  args: {
    chatId: v.id("chats"),
    content: v.string()
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Must be logged in to send messages");
    }

    const chat = await ctx.db.get(args.chatId);
    if (!chat) {
      throw new Error("Chat not found");
    }

    if (chat.buyerId !== userId && chat.sellerId !== userId) {
      throw new Error("Not authorized to send messages in this chat");
    }

    // Check if the ad still exists and is not deleted
    const ad = await ctx.db.get(chat.adId);
    if (!ad || ad.isDeleted) {
      throw new Error("Cannot send message - listing no longer available");
    }

    // Insert message
    await ctx.db.insert("messages", {
      chatId: args.chatId,
      senderId: userId,
      content: args.content,
      timestamp: Date.now(),
    });

    // Update chat last message time
    await ctx.db.patch(args.chatId, {
      lastMessageAt: Date.now(),
    });

    return { success: true };
  },
});

export const getChatMessages = query({
  args: { chatId: v.id("chats") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const chat = await ctx.db.get(args.chatId);
    if (!chat) {
      return [];
    }

    if (chat.buyerId !== userId && chat.sellerId !== userId) {
      return [];
    }

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
      .order("asc")
      .collect();

    // Get sender names
    const messagesWithSenders = await Promise.all(
      messages.map(async (message) => {
        const sender = await ctx.db.get(message.senderId);
        return {
          ...message,
          senderName: sender?.name || "Unknown",
          isCurrentUser: message.senderId === userId,
        };
      })
    );

    return messagesWithSenders;
  },
});

export const getChatForAd = query({
  args: { adId: v.id("ads") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const chat = await ctx.db
      .query("chats")
      .withIndex("by_ad_and_buyer", (q) =>
        q.eq("adId", args.adId).eq("buyerId", userId)
      )
      .unique();

    return chat;
  },
});

export const getSavedAds = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const savedAds = await ctx.db
      .query("savedAds")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    const adsWithDetails = await Promise.all(
      savedAds.map(async (savedAd) => {
        const ad = await ctx.db.get(savedAd.adId);
        // Only return ads that exist and are not deleted
        return {
          ...savedAd,
          ad: (ad && !ad.isDeleted) ? ad : null,
        };
      })
    );

    return adsWithDetails.filter(item => item.ad !== null);
  },
});
