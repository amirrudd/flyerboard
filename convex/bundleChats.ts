import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getDescopeUserId } from "./lib/auth";
import { createError } from "./lib/logger";
import { checkRateLimit } from "./lib/rateLimit";
import { notifyChatMessage } from "./lib/chatNotifications";

/**
 * Bundle-level messaging (bundle v2) — mirrors saleChats.ts.
 *
 * One thread per buyer per Bundle, keyed on (bundleId, buyerId) via the
 * `by_bundle_buyer` index. Unlike Sale threads there are no item chips: a
 * bundle IS the package (2–4 items), so the conversation is about the deal
 * itself — "I'll take all three for $530".
 *
 * A Bundle chat sets `bundleId` and leaves `adId`/`saleEventId` undefined —
 * exactly one of the three is set (enforced here, not in the validator).
 */

/** Send a message to a Bundle's seller, creating the buyer's thread on first send. */
export const sendBundleMessage = mutation({
  args: {
    bundleId: v.id("saleBundles"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getDescopeUserId(ctx);
    if (!userId) {
      throw createError("Must be logged in to message about a bundle", {
        operation: "sendBundleMessage",
      });
    }
    await checkRateLimit(ctx, userId, "sendMessage");

    const bundle = await ctx.db.get(args.bundleId);
    // Only live standalone bundles are messageable; Sale-scoped bundles talk
    // through their Sale thread. Cancelled bundles no longer reference their
    // ads — nothing to negotiate. Standalone bundles always carry sellerId
    // (populated on every write since the reconciliation), so a missing one
    // means the row isn't a standalone bundle either.
    if (!bundle || bundle.isDeleted || bundle.saleEventId || bundle.status === "cancelled" || !bundle.sellerId) {
      throw createError("Bundle not found", { operation: "sendBundleMessage", bundleId: args.bundleId });
    }
    const sellerId = bundle.sellerId;
    if (sellerId === userId) {
      throw createError("You can't message your own bundle", {
        operation: "sendBundleMessage",
        bundleId: args.bundleId,
      });
    }

    const content = args.content.trim();
    if (!content) {
      throw createError("Message can't be empty", { operation: "sendBundleMessage" });
    }

    const now = Date.now();
    const existing = await ctx.db
      .query("chats")
      .withIndex("by_bundle_buyer", (q) =>
        q.eq("bundleId", args.bundleId).eq("buyerId", userId)
      )
      .unique();

    const chatId = existing
      ? existing._id
      : await ctx.db.insert("chats", {
          bundleId: args.bundleId,
          buyerId: userId,
          sellerId,
          lastMessageAt: now,
        });

    await ctx.db.insert("messages", {
      chatId,
      senderId: userId,
      content,
      timestamp: now,
    });
    // A freshly created chat was already inserted with lastMessageAt: now.
    if (existing) {
      await ctx.db.patch(chatId, { lastMessageAt: now });
    }

    // Buyer is always the sender here (sellers can't message their own bundle),
    // so the recipient is always the seller.
    await notifyChatMessage(ctx, {
      recipientId: sellerId,
      senderId: userId,
      chatId,
      bundleId: args.bundleId,
      content,
    });

    return { chatId, success: true };
  },
});

/** The current buyer's thread for a Bundle, or empty if none yet. */
export const getBundleThread = query({
  args: { bundleId: v.id("saleBundles") },
  handler: async (ctx, args) => {
    const userId = await getDescopeUserId(ctx);
    if (!userId) return null;

    const chat = await ctx.db
      .query("chats")
      .withIndex("by_bundle_buyer", (q) =>
        q.eq("bundleId", args.bundleId).eq("buyerId", userId)
      )
      .unique();

    if (!chat) return { chatId: null, messages: [] };

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_chat", (q) => q.eq("chatId", chat._id))
      .collect();
    messages.sort((a, b) => a.timestamp - b.timestamp);

    return {
      chatId: chat._id,
      messages: messages.map((m) => ({
        _id: m._id,
        content: m.content,
        timestamp: m.timestamp,
        mine: m.senderId === userId,
      })),
    };
  },
});
