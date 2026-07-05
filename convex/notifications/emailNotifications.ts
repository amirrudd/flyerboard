"use node";

/**
 * Email Notifications using Resend
 * 
 * IMPORTANT: This file uses "use node" directive and should NOT be exported from index.ts
 * Access via internal.notifications.emailNotifications only
 */

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { components } from "../_generated/api";
import { Resend } from "@convex-dev/resend";
import type { Id } from "../_generated/dataModel";
import { chatDeepLink, INBOX_PATH } from "./queries";

// Initialize Resend client
export const resend: Resend = new Resend(components.resend, {
  // Use test mode by default - set to false in production
  testMode: process.env.RESEND_TEST_MODE !== "false",
});

/**
 * Internal action to notify a user about a new message via email
 * Called by the sendMessage / sendSaleMessage mutations.
 * Exactly one of adId / saleEventId should be provided (item-chat vs sale thread).
 */
export const notifyMessageReceived = internalAction({
  args: {
    recipientId: v.id("users"),
    senderId: v.id("users"),
    chatId: v.id("chats"),
    adId: v.optional(v.id("ads")),
    saleEventId: v.optional(v.id("saleEvents")),
    messageContent: v.string(),
  },
  handler: async (ctx, args) => {
    // Get recipient info
    const recipient = await ctx.runQuery(internal.users.getUser, {
      userId: args.recipientId,
    });

    // Check if recipient has email and notifications enabled
    if (!recipient?.email || !recipient.emailNotificationsEnabled) {
      console.log("Recipient email notifications disabled or no email address");
      return { success: false, reason: "notifications_disabled" };
    }

    // Get sender info
    const sender = await ctx.runQuery(internal.users.getUser, {
      userId: args.senderId,
    });

    // Item-vs-sale title + deep link resolved in one shared place.
    const appUrl = process.env.VITE_APP_URL || "http://localhost:5173";
    const context = await ctx.runQuery(
      internal.notifications.queries.getChatNotificationContext,
      { chatId: args.chatId, adId: args.adId, saleEventId: args.saleEventId }
    );
    if (!context) {
      console.log("No notification context (missing ad/sale), skipping email notification");
      return { success: false, reason: "no_context" };
    }
    const itemTitle = context.title;

    const senderName = sender?.name || "Someone";
    const chatUrl = `${appUrl}${context.urlPath}`;

    // Build HTML email
    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Message from ${senderName}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; border-radius: 8px; padding: 24px; margin-bottom: 20px;">
    <h2 style="margin: 0 0 16px 0; color: #1a1a1a;">💬 New Message</h2>
    <p style="margin: 0 0 12px 0; font-size: 16px;">
      <strong>${senderName}</strong> sent you a message about:
    </p>
    <p style="margin: 0; font-size: 18px; font-weight: 600; color: #0066cc;">
      "${itemTitle}"
    </p>
  </div>

  <div style="background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
    <p style="margin: 0 0 4px 0; color: #6b7280; font-size: 14px; font-weight: 500;">Message:</p>
    <p style="margin: 0; font-size: 15px; color: #1f2937; white-space: pre-wrap;">${args.messageContent}</p>
  </div>

  <div style="text-align: center; margin-bottom: 24px;">
    <a href="${chatUrl}" style="display: inline-block; background-color: #0066cc; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-weight: 600; font-size: 16px;">
      View & Reply
    </a>
  </div>

  <div style="border-top: 1px solid #e5e7eb; padding-top: 16px; margin-top: 24px;">
    <p style="margin: 0; font-size: 13px; color: #6b7280; text-align: center;">
      You're receiving this email because you have email notifications enabled for new messages.
    </p>
    <p style="margin: 8px 0 0 0; font-size: 13px; color: #6b7280; text-align: center;">
      To manage your notification settings, visit your 
      <a href="${appUrl}/dashboard?tab=profile" style="color: #0066cc; text-decoration: none;">dashboard settings</a>.
    </p>
  </div>
</body>
</html>
    `;

    // Build plain text version
    const textBody = `
New Message from ${senderName}

About: "${itemTitle}"

Message:
${args.messageContent}

View and reply: ${chatUrl}

---
You're receiving this email because you have email notifications enabled for new messages.
To manage your notification settings, visit: ${appUrl}/dashboard?tab=profile
    `.trim();

    try {
      // Send email via Resend
      await resend.sendEmail(ctx, {
        from: process.env.EMAIL_FROM || "FlyerBoard <notifications@flyerboard.com>",
        to: recipient.email,
        subject: `💬 ${senderName} sent you a message about "${itemTitle}"`,
        html: htmlBody,
        text: textBody,
        // Add List-Unsubscribe header for Gmail compliance
        headers: [
          { name: "List-Unsubscribe", value: `<${appUrl}/dashboard?tab=profile>` },
        ],
      });

      console.log(`Email notification sent to ${recipient.email}`);
      return { success: true };
    } catch (error: any) {
      console.error("Failed to send email notification:", error);
      return { success: false, reason: "send_failed", error: error.message };
    }
  },
});

/**
 * Send batched email notifications
 * Called by cron job every 5 minutes
 */
export const sendBatchedNotifications = internalAction({
  args: {},
  handler: async (ctx): Promise<{ processed: number }> => {
    const batchWindowMinutes = parseInt(process.env.EMAIL_BATCH_WINDOW_MINUTES || "10");

    // Get pending notifications grouped by recipient
    const grouped: Array<{
      recipientId: Id<"users">;
      notifications: Array<any>;
    }> = await ctx.runQuery(
      internal.notifications.pendingEmailNotifications.getPendingNotificationsToSend,
      { batchWindowMinutes }
    );

    console.log(`Processing ${grouped.length} recipients with pending notifications`);

    for (const { recipientId, notifications } of grouped) {
      try {
        // Get recipient info
        const recipient = await ctx.runQuery(internal.users.getUser, {
          userId: recipientId,
        });

        // Check if recipient has email and notifications enabled
        if (!recipient?.email || !recipient.emailNotificationsEnabled) {
          console.log(`Skipping batch for ${recipientId}: no email or notifications disabled`);
          // Clear these notifications anyway
          await ctx.runMutation(
            internal.notifications.pendingEmailNotifications.clearPendingNotifications,
            { notificationIds: notifications.map((n: any) => n._id) }
          );
          continue;
        }

        const messageCount = notifications.length;
        const appUrl = process.env.VITE_APP_URL || "http://localhost:5173";

        // Get unique chats and ads
        const uniqueChats = [...new Set(notifications.map((n: any) => n.chatId))];
        const uniqueAds = [...new Set(notifications.map((n: any) => n.adId))];

        // Build email based on count
        let subject: string;
        let htmlBody: string;
        let textBody: string;

        if (messageCount === 1) {
          // Single message - use detailed format
          const notification = notifications[0];
          const sender = await ctx.runQuery(internal.users.getUser, {
            userId: notification.senderId,
          });

          // Item-vs-sale title + deep link resolved in one shared place.
          // Unlike the immediate senders we don't skip on a missing ad/sale
          // (the queued message still deserves delivery) — fall back to a
          // generic label and the inbox deep link.
          const context = await ctx.runQuery(
            internal.notifications.queries.getChatNotificationContext,
            {
              chatId: notification.chatId,
              adId: notification.adId,
              saleEventId: notification.saleEventId,
            }
          );
          const itemTitle = context?.title ?? "your listing";
          const chatUrlPath = context?.urlPath ?? chatDeepLink(notification.chatId);

          const senderName = sender?.name || "Someone";
          const chatUrl = `${appUrl}${chatUrlPath}`;

          subject = `💬 ${senderName} sent you a message about "${itemTitle}"`;
          htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; border-radius: 8px; padding: 24px; margin-bottom: 20px;">
    <h2 style="margin: 0 0 16px 0; color: #1a1a1a;">💬 New Message</h2>
    <p style="margin: 0 0 12px 0; font-size: 16px;">
      <strong>${senderName}</strong> sent you a message about:
    </p>
    <p style="margin: 0; font-size: 18px; font-weight: 600; color: #0066cc;">
      "${itemTitle}"
    </p>
  </div>
  
  <div style="background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
    <p style="margin: 0 0 4px 0; color: #6b7280; font-size: 14px; font-weight: 500;">Message:</p>
    <p style="margin: 0; font-size: 15px; color: #1f2937; white-space: pre-wrap;">${notification.messageContent}</p>
  </div>

  <div style="text-align: center; margin-bottom: 24px;">
    <a href="${chatUrl}" style="display: inline-block; background-color: #0066cc; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-weight: 600; font-size: 16px;">
      View & Reply
    </a>
  </div>

  <div style="border-top: 1px solid #e5e7eb; padding-top: 16px; margin-top: 24px;">
    <p style="margin: 0; font-size: 13px; color: #6b7280; text-align: center;">
      You're receiving this email because you have email notifications enabled for new messages.
    </p>
    <p style="margin: 8px 0 0 0; font-size: 13px; color: #6b7280; text-align: center;">
      To manage your notification settings, visit your 
      <a href="${appUrl}/dashboard?tab=profile" style="color: #0066cc; text-decoration: none;">dashboard settings</a>.
    </p>
  </div>
</body>
</html>
                    `;

          textBody = `
New Message from ${senderName}

About: "${itemTitle}"

Message:
${notification.messageContent}

View and reply: ${chatUrl}

---
You're receiving this email because you have email notifications enabled for new messages.
To manage your notification settings, visit: ${appUrl}/dashboard?tab=profile
                    `.trim();
        } else {
          // Multiple messages - use summary format
          subject = `💬 You have ${messageCount} new message${messageCount > 1 ? 's' : ''}`;
          // /messages doesn't exist as a route either — the Messages inbox lives on the dashboard.
          const messagesUrl = `${appUrl}${INBOX_PATH}`;

          htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; border-radius: 8px; padding: 24px; margin-bottom: 20px;">
    <h2 style="margin: 0 0 16px 0; color: #1a1a1a;">💬 New Messages</h2>
    <p style="margin: 0; font-size: 18px; font-weight: 600; color: #0066cc;">
      You have ${messageCount} new message${messageCount > 1 ? 's' : ''} from ${uniqueChats.length} conversation${uniqueChats.length > 1 ? 's' : ''}
    </p>
  </div>

  <div style="text-align: center; margin-bottom: 24px;">
    <a href="${messagesUrl}" style="display: inline-block; background-color: #0066cc; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-weight: 600; font-size: 16px;">
      View All Messages
    </a>
  </div>

  <div style="border-top: 1px solid #e5e7eb; padding-top: 16px; margin-top: 24px;">
    <p style="margin: 0; font-size: 13px; color: #6b7280; text-align: center;">
      You're receiving this email because you have email notifications enabled for new messages.
    </p>
    <p style="margin: 8px 0 0 0; font-size: 13px; color: #6b7280; text-align: center;">
      To manage your notification settings, visit your 
      <a href="${appUrl}/dashboard?tab=profile" style="color: #0066cc; text-decoration: none;">dashboard settings</a>.
    </p>
  </div>
</body>
</html>
                    `;

          textBody = `
You have ${messageCount} new message${messageCount > 1 ? 's' : ''} from ${uniqueChats.length} conversation${uniqueChats.length > 1 ? 's' : ''}

View all messages: ${messagesUrl}

---
You're receiving this email because you have email notifications enabled for new messages.
To manage your notification settings, visit: ${appUrl}/dashboard?tab=profile
                    `.trim();
        }

        // Send the email
        await resend.sendEmail(ctx, {
          from: process.env.EMAIL_FROM || "FlyerBoard <notifications@flyerboard.com>",
          to: recipient.email,
          subject,
          html: htmlBody,
          text: textBody,
          headers: [
            { name: "List-Unsubscribe", value: `<${appUrl}/dashboard?tab=profile>` },
          ],
        });

        console.log(`Sent batched email to ${recipient.email} (${messageCount} messages)`);

        // Clear sent notifications
        await ctx.runMutation(
          internal.notifications.pendingEmailNotifications.clearPendingNotifications,
          { notificationIds: notifications.map((n: any) => n._id) }
        );
      } catch (error: any) {
        console.error(`Failed to send batched email to ${recipientId}:`, error);
      }
    }

    return { processed: grouped.length };
  },
});
