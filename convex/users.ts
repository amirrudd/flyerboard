import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getDescopeUserId } from "./lib/auth";
// Support profile image updates


export const updateProfile = mutation({
  args: {
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    image: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getDescopeUserId(ctx);
    if (!userId) {
      throw new Error("Must be logged in to update profile");
    }

    const updateData: any = {};
    if (args.name !== undefined) updateData.name = args.name;
    if (args.email !== undefined) updateData.email = args.email;
    if (args.image !== undefined) updateData.image = args.image;

    await ctx.db.patch(userId, updateData);

    return { success: true };
  },
});

export const deleteAccount = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getDescopeUserId(ctx);
    if (!userId) {
      throw new Error("Must be logged in to delete account");
    }

    // Delete user's ads
    const userAds = await ctx.db
      .query("ads")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    for (const ad of userAds) {
      // Delete chats for this ad
      const chats = await ctx.db
        .query("chats")
        .filter((q) => q.eq(q.field("adId"), ad._id))
        .collect();

      for (const chat of chats) {
        const messages = await ctx.db
          .query("messages")
          .withIndex("by_chat", (q) => q.eq("chatId", chat._id))
          .collect();

        for (const message of messages) {
          await ctx.db.delete(message._id);
        }

        await ctx.db.delete(chat._id);
      }

      // Delete saved ads references
      const savedAds = await ctx.db
        .query("savedAds")
        .filter((q) => q.eq(q.field("adId"), ad._id))
        .collect();

      for (const savedAd of savedAds) {
        await ctx.db.delete(savedAd._id);
      }

      await ctx.db.delete(ad._id);
    }

    // Delete user's saved ads
    const userSavedAds = await ctx.db
      .query("savedAds")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    for (const savedAd of userSavedAds) {
      await ctx.db.delete(savedAd._id);
    }

    // Delete user's chats as buyer
    const buyerChats = await ctx.db
      .query("chats")
      .withIndex("by_buyer", (q) => q.eq("buyerId", userId))
      .collect();

    for (const chat of buyerChats) {
      const messages = await ctx.db
        .query("messages")
        .withIndex("by_chat", (q) => q.eq("chatId", chat._id))
        .collect();

      for (const message of messages) {
        await ctx.db.delete(message._id);
      }

      await ctx.db.delete(chat._id);
    }

    // Finally delete the user
    await ctx.db.delete(userId);

    return { success: true };
  },
});

export const verifyIdentity = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getDescopeUserId(ctx);
    if (!userId) {
      throw new Error("Must be logged in to verify identity");
    }

    await ctx.db.patch(userId, { isVerified: true });

    return { success: true };
  },
});

export const getUserStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getDescopeUserId(ctx);
    if (!userId) {
      return null;
    }

    const ads = await ctx.db
      .query("ads")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const activeAds = ads.filter(ad => ad.isActive).length;
    const totalViews = ads.reduce((sum, ad) => sum + ad.views, 0);

    const savedAds = await ctx.db
      .query("savedAds")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const chats = await ctx.db
      .query("chats")
      .withIndex("by_seller", (q) => q.eq("sellerId", userId))
      .collect();

    const user = await ctx.db.get(userId);

    return {
      totalAds: ads.length,
      activeAds,
      totalViews,
      savedAds: savedAds.length,
      chats: chats.length,
      averageRating: user?.averageRating || 0,
      ratingCount: user?.ratingCount || 0,
    };
  },
});
