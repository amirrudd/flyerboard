import { query, mutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { getDescopeUserId } from "./lib/auth";
import { isValidEmail, normalizeEmail } from "./lib/emailUtils";
import { createError, logOperation } from "./lib/logger";

export const getUserByToken = internalQuery({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("tokenIdentifier"), args.token))
      .first();
    return user;
  },
});

// Support profile image updates

// Name validation helper
function validateName(name: string): { valid: boolean; error?: string } {
  const trimmedName = name.trim();

  // Check if empty
  if (trimmedName.length === 0) {
    return { valid: false, error: "Name cannot be empty" };
  }

  // Check minimum length
  if (trimmedName.length < 2) {
    return { valid: false, error: "Name must be at least 2 characters long" };
  }

  // Check maximum length
  if (trimmedName.length > 15) {
    return { valid: false, error: "Name cannot exceed 15 characters" };
  }

  // Check for valid characters (letters, spaces, hyphens, apostrophes only)
  const validNamePattern = /^[a-zA-Z\s\-']+$/;
  if (!validNamePattern.test(trimmedName)) {
    return { valid: false, error: "Name can only contain letters, spaces, hyphens, and apostrophes" };
  }

  return { valid: true };
}

export const updateProfile = mutation({
  args: {
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    image: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getDescopeUserId(ctx);
    if (!userId) {
      throw createError("Must be logged in to update profile", { operation: "updateProfile" });
    }

    const updateData: any = {};

    // Validate and process name
    if (args.name !== undefined) {
      const validation = validateName(args.name);
      if (!validation.valid) {
        throw new Error(validation.error);
      }
      updateData.name = args.name.trim();
    }

    if (args.image !== undefined) updateData.image = args.image;

    // Handle email updates with normalization and validation
    const normalizedEmail = normalizeEmail(args.email);

    if (normalizedEmail !== null) {
      // Validate email format
      if (!isValidEmail(normalizedEmail)) {
        throw createError("Invalid email format", { email: normalizedEmail, userId });
      }

      // Check if another user already has this email
      // This is critical to prevent account hijacking/confusion
      const otherUser = await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", normalizedEmail))
        .first();

      if (otherUser && otherUser._id !== userId) {
        throw createError("Email already in use by another account", { email: normalizedEmail, userId });
      }
      updateData.email = normalizedEmail;
    }

    await ctx.db.patch(userId, updateData);

    return { success: true };
  },
});

export const deleteAccount = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getDescopeUserId(ctx);
    if (!userId) {
      throw createError("Must be logged in to delete account", { operation: "deleteAccount" });
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

    logOperation("Account deleted", { userId, adsDeleted: userAds.length, chatsDeleted: buyerChats.length });
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
      .filter((q) => q.neq(q.field("isDeleted"), true))
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
