import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getDescopeUserId } from "./lib/auth";
import { createError } from "./lib/logger";
import { checkRateLimit } from "./lib/rateLimit";
import { notifyChatMessage } from "./lib/chatNotifications";

/**
 * Sale-level messaging (v2).
 *
 * One thread per buyer per Sale, keyed on (saleEventId, buyerId) via the
 * `by_sale_event_buyer` index. Items are referenced as optional chips
 * (`referencedAdIds`) inside messages, so "can I get the chair and the bookshelf
 * for $70?" stays one conversation instead of fragmenting per item.
 *
 * A Sale chat sets `saleEventId` and leaves `adId` undefined — the inverse of a
 * single-listing chat. (Exactly one is set; enforced here, not in the validator.)
 */

/** Send a message to a Sale's seller, creating the buyer's thread on first send. */
export const sendSaleMessage = mutation({
  args: {
    saleEventId: v.id("saleEvents"),
    content: v.string(),
    referencedAdIds: v.optional(v.array(v.id("ads"))),
  },
  handler: async (ctx, args) => {
    const userId = await getDescopeUserId(ctx);
    if (!userId) {
      throw createError("Must be logged in to message a sale", {
        operation: "sendSaleMessage",
      });
    }
    await checkRateLimit(ctx, userId, "sendMessage");

    const sale = await ctx.db.get(args.saleEventId);
    if (!sale || sale.status === "draft") {
      throw createError("Sale not found", { operation: "sendSaleMessage", saleEventId: args.saleEventId });
    }
    if (sale.userId === userId) {
      throw createError("You can't message your own sale", {
        operation: "sendSaleMessage",
        saleEventId: args.saleEventId,
      });
    }

    const content = args.content.trim();
    if (!content) {
      throw createError("Message can't be empty", { operation: "sendSaleMessage" });
    }

    // Keep only referenced ads that actually belong to this sale.
    let chips = args.referencedAdIds;
    if (chips && chips.length > 0) {
      const valid: typeof chips = [];
      for (const adId of chips) {
        const ad = await ctx.db.get(adId);
        if (ad && ad.saleEventId === args.saleEventId) valid.push(adId);
      }
      chips = valid.length > 0 ? valid : undefined;
    }

    const now = Date.now();
    const existing = await ctx.db
      .query("chats")
      .withIndex("by_sale_event_buyer", (q) =>
        q.eq("saleEventId", args.saleEventId).eq("buyerId", userId)
      )
      .unique();

    // An ended sale accepts no NEW threads (backend enforcement of the end-sale
    // promise); existing threads stay open so pickups can be coordinated.
    if (!existing && sale.status === "ended") {
      throw createError("This sale has ended", {
        operation: "sendSaleMessage",
        saleEventId: args.saleEventId,
      });
    }

    const chatId = existing
      ? existing._id
      : await ctx.db.insert("chats", {
          saleEventId: args.saleEventId,
          buyerId: userId,
          sellerId: sale.userId,
          lastMessageAt: now,
        });

    await ctx.db.insert("messages", {
      chatId,
      senderId: userId,
      content,
      timestamp: now,
      referencedAdIds: chips,
    });
    await ctx.db.patch(chatId, { lastMessageAt: now });

    // Buyer is always the sender here (sellers can't message their own sale),
    // so the recipient is always the seller.
    await notifyChatMessage(ctx, {
      recipientId: sale.userId,
      senderId: userId,
      chatId,
      saleEventId: args.saleEventId,
      content,
    });

    return { chatId, success: true };
  },
});

/** The current buyer's thread for a Sale (messages + chips), or empty if none yet. */
export const getSaleThread = query({
  args: { saleEventId: v.id("saleEvents") },
  handler: async (ctx, args) => {
    const userId = await getDescopeUserId(ctx);
    if (!userId) return null;

    const chat = await ctx.db
      .query("chats")
      .withIndex("by_sale_event_buyer", (q) =>
        q.eq("saleEventId", args.saleEventId).eq("buyerId", userId)
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
        referencedAdIds: m.referencedAdIds ?? [],
        mine: m.senderId === userId,
      })),
    };
  },
});
