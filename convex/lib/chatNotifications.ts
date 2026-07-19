import { internal } from "../_generated/api";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

/**
 * Notify a chat-message recipient via push (scheduled) and batched email —
 * the single implementation behind every message-send mutation
 * (messages.sendMessage, adDetail.sendFirstMessage, saleChats, bundleChats).
 * Each channel is gated on its env feature flag. Exactly one of
 * adId / saleEventId / bundleId identifies the thread kind.
 */
export async function notifyChatMessage(
  ctx: MutationCtx,
  args: {
    recipientId: Id<"users">;
    senderId: Id<"users">;
    chatId: Id<"chats">;
    adId?: Id<"ads">;
    saleEventId?: Id<"saleEvents">;
    bundleId?: Id<"saleBundles">;
    content: string;
  }
): Promise<void> {
  const { content, ...ids } = args;

  if (process.env.ENABLE_PUSH_NOTIFICATIONS === "true") {
    await ctx.scheduler.runAfter(
      0,
      internal.notifications.pushNotifications.notifyMessageReceived,
      ids
    );
  }

  if (process.env.ENABLE_EMAIL_NOTIFICATIONS === "true") {
    await ctx.runMutation(
      internal.notifications.pendingEmailNotifications.queueEmailNotification,
      { ...ids, messageContent: content }
    );
  }
}
