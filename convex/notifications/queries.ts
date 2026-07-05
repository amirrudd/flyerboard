import { internalQuery } from "../_generated/server";
import { v } from "convex/values";

/**
 * Canonical in-app deep links for message notifications. There is no
 * /messages/... route in the app — every notification must land on the
 * unified inbox. These helpers are the only place that rule lives.
 */
export const INBOX_PATH = "/dashboard?tab=chats";
export function chatDeepLink(chatId: string): string {
    return `${INBOX_PATH}&chat=${chatId}`;
}

/**
 * Resolve the display title + in-app deep link for a chat notification,
 * branching on item-chat (adId) vs Moving Sale thread (saleEventId) in ONE
 * place for all senders (push + both email paths). Returns null when the
 * referenced ad/sale is missing or deleted — senders should skip.
 *
 * Lives in this file because pushNotifications.ts uses "use node" and can
 * only contain actions, not queries.
 */
export const getChatNotificationContext = internalQuery({
    args: {
        chatId: v.id("chats"),
        adId: v.optional(v.id("ads")),
        saleEventId: v.optional(v.id("saleEvents")),
        bundleId: v.optional(v.id("saleBundles")),
    },
    handler: async (ctx, args) => {
        if (args.bundleId) {
            const bundle = await ctx.db.get(args.bundleId);
            if (!bundle || bundle.isDeleted) {
                return null;
            }
            return {
                title: bundle.label,
                urlPath: `/bundle/${args.bundleId}`,
            };
        }
        if (args.saleEventId) {
            const sale = await ctx.db.get(args.saleEventId);
            if (!sale) {
                return null;
            }
            return {
                title: sale.title,
                urlPath: sale.slug ? `/sale/${sale.slug}` : chatDeepLink(args.chatId),
            };
        }
        if (args.adId) {
            const ad = await ctx.db.get(args.adId);
            if (!ad || ad.isDeleted) {
                return null;
            }
            return { title: ad.title, urlPath: chatDeepLink(args.chatId) };
        }
        return null;
    },
});
