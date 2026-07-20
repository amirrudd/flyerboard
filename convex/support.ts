import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { getDescopeUserId } from "./lib/auth";
import { checkRateLimit } from "./lib/rateLimit";
import { createError, logOperation } from "./lib/logger";

/**
 * Support form submission. Stores an audit-trail row first (survives email
 * failures), then schedules the notification email to the support inbox.
 * Signed-in only — the rate limiter is keyed per userId; signed-out visitors
 * use the mailto card on /support.
 */
export const submitSupportRequest = mutation({
  args: {
    subject: v.string(),
    body: v.string(),
    // Reply-to. Optional when the user's account already has an email.
    email: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getDescopeUserId(ctx);
    if (!userId) {
      throw createError("Must be signed in to send a support request", {
        operation: "submitSupportRequest",
      });
    }

    await checkRateLimit(ctx, userId, "supportRequest");

    const subject = args.subject.trim();
    const body = args.body.trim();
    if (!subject || body.length < 10) {
      throw createError("Please add a subject and a bit more detail", {
        operation: "submitSupportRequest",
        userId,
      });
    }
    if (subject.length > 200 || body.length > 5000) {
      throw createError("Subject or message is too long", {
        operation: "submitSupportRequest",
        userId,
      });
    }

    const user = await ctx.db.get(userId);
    const email = (args.email ?? user?.email ?? "").trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      throw createError("A valid reply-to email is required", {
        operation: "submitSupportRequest",
        userId,
      });
    }

    const requestId = await ctx.db.insert("supportRequests", {
      userId,
      email,
      subject,
      body,
    });

    await ctx.scheduler.runAfter(
      0,
      internal.notifications.emailNotifications.sendSupportRequestEmail,
      { requestId, email, subject, body, userName: user?.name ?? "Unknown user" }
    );

    logOperation("Support request submitted", { requestId, userId });
    return { success: true };
  },
});
