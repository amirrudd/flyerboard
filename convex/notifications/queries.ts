import { internalQuery } from "../_generated/server";
import { v } from "convex/values";

/**
 * Internal query to get ad title for notifications
 * This is in a separate file because pushNotifications.ts uses "use node"
 * and can only contain actions, not queries or mutations
 */
export const getAdTitleQuery = internalQuery({
    args: { adId: v.id("ads") },
    handler: async (ctx, args) => {
        const ad = await ctx.db.get(args.adId);
        if (!ad || ad.isDeleted) {
            return null;
        }
        return { title: ad.title };
    },
});
