import { v } from "convex/values";
import { mutation, internalMutation, internalQuery } from "../_generated/server";
import { Id } from "../_generated/dataModel";

/**
 * Queue an email notification for batching
 * Called by sendMessage mutation instead of sending immediately
 */
export const queueEmailNotification = internalMutation({
    args: {
        recipientId: v.id("users"),
        chatId: v.id("chats"),
        adId: v.id("ads"),
        senderId: v.id("users"),
        messageContent: v.string(),
    },
    handler: async (ctx, args) => {
        await ctx.db.insert("pendingEmailNotifications", {
            recipientId: args.recipientId,
            chatId: args.chatId,
            adId: args.adId,
            senderId: args.senderId,
            messageContent: args.messageContent,
            createdAt: Date.now(),
        });
    },
});

/**
 * Get pending notifications older than the batch window
 * Used by cron job to send batched emails
 */
export const getPendingNotificationsToSend = internalQuery({
    args: {
        batchWindowMinutes: v.number(),
    },
    handler: async (ctx, args) => {
        const cutoffTime = Date.now() - args.batchWindowMinutes * 60 * 1000;

        const pending = await ctx.db
            .query("pendingEmailNotifications")
            .withIndex("by_created_at")
            .filter((q) => q.lte(q.field("createdAt"), cutoffTime))
            .collect();

        // Group by recipient
        const grouped = new Map<Id<"users">, typeof pending>();
        for (const notification of pending) {
            const existing = grouped.get(notification.recipientId) || [];
            existing.push(notification);
            grouped.set(notification.recipientId, existing);
        }

        return Array.from(grouped.entries()).map(([recipientId, notifications]) => ({
            recipientId,
            notifications,
        }));
    },
});

/**
 * Clear pending notifications after they've been sent
 */
export const clearPendingNotifications = internalMutation({
    args: {
        notificationIds: v.array(v.id("pendingEmailNotifications")),
    },
    handler: async (ctx, args) => {
        for (const id of args.notificationIds) {
            await ctx.db.delete(id);
        }
    },
});
