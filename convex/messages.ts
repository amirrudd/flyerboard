import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getDescopeUserId } from "./lib/auth";
import { checkRateLimit } from "./lib/rateLimit";
import { notifyChatMessage } from "./lib/chatNotifications";
import { countUnreadForChat } from "./lib/unread";

export const getAdChats = query({
  args: { adId: v.id("ads") },
  handler: async (ctx, args) => {
    const userId = await getDescopeUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Verify the user owns this ad
    const ad = await ctx.db.get(args.adId);
    if (!ad || ad.userId !== userId) {
      throw new Error("Not authorized to view these messages");
    }

    const chats = await ctx.db
      .query("chats")
      .withIndex("by_ad", (q) => q.eq("adId", args.adId))
      .collect();

    const chatsWithDetails = await Promise.all(
      chats.map(async (chat) => {
        const buyer = await ctx.db.get(chat.buyerId);
        const latestMessage = await ctx.db
          .query("messages")
          .withIndex("by_chat", (q) => q.eq("chatId", chat._id))
          .order("desc")
          .first();

        // Count unread messages for seller
        const unreadCount = await countUnreadForChat(ctx, chat, userId, "seller");

        return {
          ...chat,
          buyer: buyer ? buyer : { _id: chat.buyerId, name: null, isDeleted: true },
          latestMessage,
          unreadCount,
        };
      })
    );

    return chatsWithDetails;
  },
});

export const getChatMessages = query({
  args: { chatId: v.id("chats") },
  handler: async (ctx, args) => {
    const userId = await getDescopeUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const chat = await ctx.db.get(args.chatId);
    if (!chat) {
      throw new Error("Chat not found");
    }

    // Verify user is part of this chat
    if (chat.buyerId !== userId && chat.sellerId !== userId) {
      throw new Error("Not authorized to view this chat");
    }

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
      .order("asc")
      .collect();

    const messagesWithSender = await Promise.all(
      messages.map(async (message) => {
        const sender = await ctx.db.get(message.senderId);
        return {
          ...message,
          sender,
        };
      })
    );

    return messagesWithSender;
  },
});

export const sendMessage = mutation({
  args: {
    chatId: v.id("chats"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getDescopeUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Rate limit: 60 messages per minute
    await checkRateLimit(ctx, userId, "sendMessage");

    const chat = await ctx.db.get(args.chatId);
    if (!chat) {
      throw new Error("Chat not found");
    }

    // Verify user is part of this chat
    if (chat.buyerId !== userId && chat.sellerId !== userId) {
      throw new Error("Not authorized to send messages in this chat");
    }

    // For single-listing chats, block sends once the flyer is soft-deleted.
    // Sale/Bundle threads (no adId) are gated by the sale/bundle itself.
    if (chat.adId) {
      const ad = await ctx.db.get(chat.adId);
      if (!ad || ad.isDeleted) {
        throw new Error("Cannot send message - flyer no longer available");
      }
    }

    const timestamp = Date.now();

    // Create the message
    await ctx.db.insert("messages", {
      chatId: args.chatId,
      senderId: userId,
      content: args.content,
      timestamp,
    });

    // Update chat's last message timestamp
    await ctx.db.patch(args.chatId, {
      lastMessageAt: timestamp,
    });

    // Notify the other party — covers item-chats, Moving Sale threads, and
    // Bundle threads (exactly one of adId/saleEventId/bundleId is set per chat).
    await notifyChatMessage(ctx, {
      recipientId: chat.buyerId === userId ? chat.sellerId : chat.buyerId,
      senderId: userId,
      chatId: args.chatId,
      adId: chat.adId,
      saleEventId: chat.saleEventId,
      bundleId: chat.bundleId,
      content: args.content,
    });

    return { success: true };
  },
});

export const markChatAsRead = mutation({
  args: { chatId: v.id("chats") },
  handler: async (ctx, args) => {
    const userId = await getDescopeUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const chat = await ctx.db.get(args.chatId);
    if (!chat) {
      throw new Error("Chat not found");
    }

    const timestamp = Date.now();

    // Update the appropriate read timestamp based on user role
    if (chat.sellerId === userId) {
      await ctx.db.patch(args.chatId, {
        lastReadBySeller: timestamp,
      });
    } else if (chat.buyerId === userId) {
      await ctx.db.patch(args.chatId, {
        lastReadByBuyer: timestamp,
      });
    }

    return { success: true };
  },
});

/**
 * Total unread message count across every chat the user participates in
 * (as seller or buyer), excluding chats archived for that role. Feeds the
 * always-mounted nav badge, so it must never throw — returns 0 when
 * unauthenticated.
 */
export const getTotalUnreadCount = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const userId = await getDescopeUserId(ctx);
    if (!userId) {
      return 0;
    }

    const sellerChats = await ctx.db
      .query("chats")
      .withIndex("by_seller", (q) => q.eq("sellerId", userId))
      .filter((q) => q.neq(q.field("archivedBySeller"), true))
      .filter((q) => q.neq(q.field("deletedBySeller"), true))
      .collect();

    const buyerChats = await ctx.db
      .query("chats")
      .withIndex("by_buyer", (q) => q.eq("buyerId", userId))
      .filter((q) => q.neq(q.field("archivedByBuyer"), true))
      .filter((q) => q.neq(q.field("deletedByBuyer"), true))
      .collect();

    const counts = await Promise.all([
      ...sellerChats.map((chat) => countUnreadForChat(ctx, chat, userId, "seller")),
      ...buyerChats.map((chat) => countUnreadForChat(ctx, chat, userId, "buyer")),
    ]);

    return counts.reduce((sum, count) => sum + count, 0);
  },
});

export const getUnreadCounts = query({
  args: { adIds: v.array(v.id("ads")) },
  handler: async (ctx, args) => {
    const userId = await getDescopeUserId(ctx);
    if (!userId) {
      return {};
    }

    const unreadCounts: Record<string, number> = {};

    for (const adId of args.adIds) {
      const ad = await ctx.db.get(adId);
      if (!ad || ad.userId !== userId) {
        continue;
      }

      const chats = await ctx.db
        .query("chats")
        .withIndex("by_ad", (q) => q.eq("adId", adId))
        .collect();

      const counts = await Promise.all(
        chats.map((chat) => countUnreadForChat(ctx, chat, userId, "seller"))
      );
      unreadCounts[adId] = counts.reduce((sum, count) => sum + count, 0);
    }

    return unreadCounts;
  },
});

export const archiveChat = mutation({
  args: { chatId: v.id("chats") },
  handler: async (ctx, args) => {
    const userId = await getDescopeUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const chat = await ctx.db.get(args.chatId);
    if (!chat) {
      throw new Error("Chat not found");
    }

    // Check if user is part of this chat
    if (chat.buyerId !== userId && chat.sellerId !== userId) {
      throw new Error("Not authorized to archive this chat");
    }

    // Archive for the appropriate user
    if (chat.buyerId === userId) {
      await ctx.db.patch(args.chatId, {
        archivedByBuyer: true,
      });
    } else if (chat.sellerId === userId) {
      await ctx.db.patch(args.chatId, {
        archivedBySeller: true,
      });
    }

    return { success: true };
  },
});

export const unarchiveChat = mutation({
  args: { chatId: v.id("chats") },
  handler: async (ctx, args) => {
    const userId = await getDescopeUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const chat = await ctx.db.get(args.chatId);
    if (!chat) {
      throw new Error("Chat not found");
    }

    // Check if user is part of this chat
    if (chat.buyerId !== userId && chat.sellerId !== userId) {
      throw new Error("Not authorized to unarchive this chat");
    }

    // Unarchive for the appropriate user
    if (chat.buyerId === userId) {
      await ctx.db.patch(args.chatId, {
        archivedByBuyer: false,
      });
    } else if (chat.sellerId === userId) {
      await ctx.db.patch(args.chatId, {
        archivedBySeller: false,
      });
    }

    return { success: true };
  },
});

export const getArchivedChats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getDescopeUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const archivedChats = await ctx.db
      .query("chats")
      .withIndex("by_buyer_archived", (q) =>
        q.eq("buyerId", userId).eq("archivedByBuyer", true)
      )
      .filter((q) => q.neq(q.field("deletedByBuyer"), true))
      .collect();

    const chatsWithDetails = await Promise.all(
      archivedChats.map(async (chat) => {
        const ad = chat.adId ? await ctx.db.get(chat.adId) : null;
        const seller = await ctx.db.get(chat.sellerId);
        const latestMessage = await ctx.db
          .query("messages")
          .withIndex("by_chat", (q) => q.eq("chatId", chat._id))
          .order("desc")
          .first();

        return { ...chat, ad, seller, latestMessage };
      })
    );

    return chatsWithDetails.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
  },
});

export const deleteArchivedChats = mutation({
  args: { chatIds: v.array(v.id("chats")) },
  handler: async (ctx, args) => {
    const userId = await getDescopeUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    for (const chatId of args.chatIds) {
      const chat = await ctx.db.get(chatId);
      if (!chat) continue;

      const iAmBuyer = chat.buyerId === userId;
      // Auth: caller must be a participant.
      if (!iAmBuyer && chat.sellerId !== userId) continue;

      // Only archived chats can be deleted (matches the ArchivedView UI gate).
      const archived = iAmBuyer ? chat.archivedByBuyer : chat.archivedBySeller;
      if (!archived) continue;

      const otherDeleted = iAmBuyer ? chat.deletedBySeller : chat.deletedByBuyer;
      if (otherDeleted) {
        // ponytail: both sides have now deleted — hard-delete inline (no cron).
        // A chat deleted by only one side lingers hidden from that user until
        // the other side also deletes; that's intended, not a leak to reap.
        const messages = await ctx.db
          .query("messages")
          .withIndex("by_chat", (q) => q.eq("chatId", chatId))
          .collect();

        for (const message of messages) {
          await ctx.db.delete(message._id);
        }
        await ctx.db.delete(chatId);
      } else {
        await ctx.db.patch(
          chatId,
          iAmBuyer ? { deletedByBuyer: true } : { deletedBySeller: true }
        );
      }
    }

    return { success: true };
  },
});
