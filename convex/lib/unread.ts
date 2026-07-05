import { QueryCtx } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";

/**
 * Count messages in a chat that are unread for one participant: sent by the
 * other party after that participant's role-specific last-read timestamp.
 *
 * The single source of truth for unread semantics — used by getAdChats,
 * getUnreadCounts, getTotalUnreadCount (messages.ts) and getSellerChats /
 * getBuyerChats (posts.ts). Change read semantics here, nowhere else.
 */
export async function countUnreadForChat(
  ctx: QueryCtx,
  chat: Doc<"chats">,
  userId: Id<"users">,
  role: "seller" | "buyer"
): Promise<number> {
  const lastRead =
    (role === "seller" ? chat.lastReadBySeller : chat.lastReadByBuyer) ?? 0;

  const unread = await ctx.db
    .query("messages")
    .withIndex("by_chat", (q) => q.eq("chatId", chat._id))
    .filter((q) =>
      q.and(
        q.neq(q.field("senderId"), userId),
        q.gt(q.field("timestamp"), lastRead)
      )
    )
    .collect();

  return unread.length;
}
