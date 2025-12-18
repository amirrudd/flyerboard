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

// Initialize Resend client
export const resend: Resend = new Resend(components.resend, {
    // Use test mode by default - set to false in production
    testMode: process.env.RESEND_TEST_MODE !== "false",
});

/**
 * Internal action to notify a user about a new message via email
 * Called by the sendMessage mutation
 */
export const notifyMessageReceived = internalAction({
    args: {
        recipientId: v.id("users"),
        senderId: v.id("users"),
        chatId: v.id("chats"),
        adId: v.id("ads"),
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

        // Get ad info for context
        const ad = await ctx.runQuery(internal.notifications.queries.getAdTitleQuery, {
            adId: args.adId,
        });

        if (!ad) {
            console.log("Ad not found, skipping email notification");
            return { success: false, reason: "ad_not_found" };
        }

        const senderName = sender?.name || "Someone";
        const appUrl = process.env.VITE_APP_URL || "http://localhost:5173";
        const chatUrl = `${appUrl}/messages/${args.chatId}`;

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
      "${ad.title}"
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

About: "${ad.title}"

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
                subject: `💬 ${senderName} sent you a message about "${ad.title}"`,
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
