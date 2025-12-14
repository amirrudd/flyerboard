"use node";

import { v } from "convex/values";
import { action, internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

/**
 * Send a push notification to a specific user
 * This is an internal action that uses the web-push library
 * 
 * @param userId - Recipient user ID
 * @param title - Notification title
 * @param body - Notification body text
 * @param url - URL to open when notification is clicked
 * @param chatId - Optional chat ID for context
 */
export const sendPushNotification = internalAction({
    args: {
        userId: v.id("users"),
        title: v.string(),
        body: v.string(),
        url: v.string(),
        chatId: v.optional(v.id("chats")),
    },
    handler: async (ctx, args) => {
        // Check if push notifications are enabled
        const enabled = process.env.ENABLE_PUSH_NOTIFICATIONS === 'true';
        if (!enabled) {
            console.log("Push notifications disabled, skipping");
            return { success: false, reason: "disabled" };
        }

        // Get user's push subscriptions
        const subscriptions: any = await ctx.runQuery(
            internal.notifications.pushSubscriptions.getUserSubscriptionsInternal,
            { userId: args.userId }
        );

        if (subscriptions.length === 0) {
            console.log(`No push subscriptions found for user ${args.userId}`);
            return { success: false, reason: "no_subscriptions" };
        }

        // Import web-push dynamically (only available in Node.js environment)
        const webpush = await import("web-push");

        // Configure VAPID details
        const vapidPublicKey = process.env.VITE_VAPID_PUBLIC_KEY;
        const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
        const vapidSubject = process.env.VAPID_SUBJECT || "mailto:support@flyerboard.com";

        if (!vapidPublicKey || !vapidPrivateKey) {
            console.error("VAPID keys not configured");
            return { success: false, reason: "vapid_not_configured" };
        }

        webpush.default.setVapidDetails(
            vapidSubject,
            vapidPublicKey,
            vapidPrivateKey
        );

        // Prepare notification payload
        const payload = JSON.stringify({
            title: args.title,
            body: args.body,
            url: args.url,
            chatId: args.chatId,
            timestamp: Date.now(),
        });

        // Send to all user's subscriptions
        const results = await Promise.allSettled(
            subscriptions.map(async (sub: typeof subscriptions[0]) => {
                try {
                    const pushSubscription = {
                        endpoint: sub.endpoint,
                        keys: {
                            p256dh: sub.keys.p256dh,
                            auth: sub.keys.auth,
                        },
                    };

                    await webpush.default.sendNotification(pushSubscription, payload);

                    // Update last used timestamp
                    await ctx.runMutation(
                        internal.notifications.pushSubscriptions.updateLastUsed,
                        { subscriptionId: sub._id }
                    );

                    return { success: true, endpoint: sub.endpoint };
                } catch (error: any) {
                    console.error(`Failed to send push to ${sub.endpoint}:`, error);

                    // If subscription is invalid (410 Gone), remove it
                    if (error.statusCode === 410) {
                        await ctx.runMutation(
                            internal.notifications.pushSubscriptions.removeByEndpoint,
                            { endpoint: sub.endpoint }
                        );
                    }

                    return { success: false, endpoint: sub.endpoint, error: error.message };
                }
            })
        );

        const successCount = results.filter(
            (r: any): r is PromiseFulfilledResult<{ success: boolean; endpoint: string; error?: string }> => r.status === "fulfilled" && r.value.success
        ).length;

        return {
            success: successCount > 0,
            totalSubscriptions: subscriptions.length,
            successCount,
        };
    },
});

/**
 * Internal action to notify a user about a new message
 * Called by the sendMessage mutation
 * 
 * @param recipientId - User receiving the message
 * @param senderId - User who sent the message
 * @param chatId - Chat ID
 * @param adId - Ad ID for context
 */
export const notifyMessageReceived = internalAction({
    args: {
        recipientId: v.id("users"),
        senderId: v.id("users"),
        chatId: v.id("chats"),
        adId: v.id("ads"),
    },
    handler: async (ctx, args) => {
        // Get sender info
        const sender = await ctx.runQuery(internal.users.getUser, {
            userId: args.senderId,
        });

        // Get ad title directly from database (using query from queries.ts)
        const ad = await ctx.runQuery(internal.notifications.queries.getAdTitleQuery, {
            adId: args.adId,
        });

        if (!ad) {
            console.log("Ad not found, skipping notification");
            return;
        }

        const senderName = sender?.name || "Someone";

        // Privacy: Don't reveal message content, just show ad title
        const notificationBody = `New message about "${ad.title}"`;

        // Send push notification
        await ctx.runAction(internal.notifications.pushNotifications.sendPushNotification, {
            userId: args.recipientId,
            title: `Message from ${senderName}`,
            body: notificationBody,
            url: `/messages/${args.chatId}`,
            chatId: args.chatId,
        });
    },
});
