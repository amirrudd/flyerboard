import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getDescopeUserId } from "./lib/auth";
import { internal } from "./_generated/api";
import { checkRateLimit } from "./lib/rateLimit";

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
        const unreadCount = await ctx.db
          .query("messages")
          .withIndex("by_chat", (q) => q.eq("chatId", chat._id))
          .filter((q) =>
            q.and(
              q.neq(q.field("senderId"), userId),
              q.gt(q.field("timestamp"), chat.lastReadBySeller ?? 0)
            )
          )
          .collect()
          .then(messages => messages.length);

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

    // Send push notification to recipient (if enabled)
    if (process.env.ENABLE_PUSH_NOTIFICATIONS === 'true') {
      const recipientId = chat.buyerId === userId ? chat.sellerId : chat.buyerId;

      // Schedule push notification
      await ctx.scheduler.runAfter(
        0,
        internal.notifications.pushNotifications.notifyMessageReceived,
        {
          recipientId,
          senderId: userId,
          chatId: args.chatId,
          adId: chat.adId,
        }
      );
    }

    // Queue email notification for batching (if feature is enabled)
    if (process.env.ENABLE_EMAIL_NOTIFICATIONS === 'true') {
      const recipientId = chat.buyerId === userId ? chat.sellerId : chat.buyerId;

      // Queue notification instead of sending immediately
      await ctx.runMutation(
        internal.notifications.pendingEmailNotifications.queueEmailNotification,
        {
          recipientId,
          senderId: userId,
          chatId: args.chatId,
          adId: chat.adId,
          messageContent: args.content,
        }
      );
    }

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

      let totalUnread = 0;
      for (const chat of chats) {
        const unreadMessages = await ctx.db
          .query("messages")
          .withIndex("by_chat", (q) => q.eq("chatId", chat._id))
          .filter((q) =>
            q.and(
              q.neq(q.field("senderId"), userId),
              q.gt(q.field("timestamp"), chat.lastReadBySeller ?? 0)
            )
          )
          .collect();

        totalUnread += unreadMessages.length;
      }

      unreadCounts[adId] = totalUnread;
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
      .collect();

    const chatsWithDetails = await Promise.all(
      archivedChats.map(async (chat) => {
        const ad = await ctx.db.get(chat.adId);
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

      if (chat.buyerId === userId && chat.archivedByBuyer) {
        const messages = await ctx.db
          .query("messages")
          .withIndex("by_chat", (q) => q.eq("chatId", chatId))
          .collect();

        for (const message of messages) {
          await ctx.db.delete(message._id);
        }
        await ctx.db.delete(chatId);
      }
    }

    return { success: true };
  },
});
