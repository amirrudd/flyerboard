import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "../_generated/server";
import { getDescopeUserId } from "../lib/auth";

/**
 * Save or update a push notification subscription for the current user
 * 
 * @param endpoint - Push service endpoint URL
 * @param keys - Encryption keys (p256dh and auth)
 * @param userAgent - Optional browser/device information
 */
export const savePushSubscription = mutation({
    args: {
        endpoint: v.string(),
        keys: v.object({
            p256dh: v.string(),
            auth: v.string(),
        }),
        userAgent: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const userId = await getDescopeUserId(ctx);
        if (!userId) {
            throw new Error("Not authenticated");
        }

        // Check if subscription already exists for this endpoint
        const existing = await ctx.db
            .query("pushSubscriptions")
            .withIndex("by_endpoint", (q) => q.eq("endpoint", args.endpoint))
            .first();

        if (existing) {
            // Update existing subscription (user might have re-subscribed)
            await ctx.db.patch(existing._id, {
                userId,
                keys: args.keys,
                userAgent: args.userAgent,
            });
            return { success: true, subscriptionId: existing._id };
        } else {
            // Create new subscription
            const subscriptionId = await ctx.db.insert("pushSubscriptions", {
                userId,
                endpoint: args.endpoint,
                keys: args.keys,
                userAgent: args.userAgent,
                createdAt: Date.now(),
            });
            return { success: true, subscriptionId };
        }
    },
});

/**
 * Remove a push notification subscription
 * 
 * @param endpoint - Push service endpoint URL to remove
 */
export const removePushSubscription = mutation({
    args: { endpoint: v.string() },
    handler: async (ctx, args) => {
        const userId = await getDescopeUserId(ctx);
        if (!userId) {
            throw new Error("Not authenticated");
        }

        const subscription = await ctx.db
            .query("pushSubscriptions")
            .withIndex("by_endpoint", (q) => q.eq("endpoint", args.endpoint))
            .first();

        if (subscription && subscription.userId === userId) {
            await ctx.db.delete(subscription._id);
            return { success: true };
        }

        return { success: false, message: "Subscription not found" };
    },
});

/**
 * Get all push subscriptions for the current user
 */
export const getUserSubscriptions = query({
    args: {},
    handler: async (ctx) => {
        const userId = await getDescopeUserId(ctx);
        if (!userId) {
            return [];
        }

        const subscriptions = await ctx.db
            .query("pushSubscriptions")
            .withIndex("by_user", (q) => q.eq("userId", userId))
            .collect();

        return subscriptions;
    },
});

/**
 * Clean up stale subscriptions (older than 90 days with no usage)
 * This is an internal mutation that can be called periodically
 */
export const cleanupStaleSubscriptions = mutation({
    args: {},
    handler: async (ctx) => {
        const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;

        const allSubscriptions = await ctx.db.query("pushSubscriptions").collect();
        let deletedCount = 0;

        for (const sub of allSubscriptions) {
            const isStale =
                sub.createdAt < ninetyDaysAgo &&
                (!sub.lastUsed || sub.lastUsed < ninetyDaysAgo);

            if (isStale) {
                await ctx.db.delete(sub._id);
                deletedCount++;
            }
        }

        return { success: true, deletedCount };
    },
});

// ============================================================================
// Internal functions (used by other Convex functions)
// ============================================================================

/**
 * Internal query to get user subscriptions by userId
 * Used by the push notification action
 */
export const getUserSubscriptionsInternal = internalQuery({
    args: { userId: v.id("users") },
    handler: async (ctx, args) => {
        const subscriptions = await ctx.db
            .query("pushSubscriptions")
            .withIndex("by_user", (q) => q.eq("userId", args.userId))
            .collect();

        return subscriptions;
    },
});

/**
 * Internal mutation to update last used timestamp
 */
export const updateLastUsed = internalMutation({
    args: { subscriptionId: v.id("pushSubscriptions") },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.subscriptionId, {
            lastUsed: Date.now(),
        });
    },
});

/**
 * Internal mutation to remove subscription by endpoint
 * Used when subscription is invalid (410 Gone)
 */
export const removeByEndpoint = internalMutation({
    args: { endpoint: v.string() },
    handler: async (ctx, args) => {
        const subscription = await ctx.db
            .query("pushSubscriptions")
            .withIndex("by_endpoint", (q) => q.eq("endpoint", args.endpoint))
            .first();

        if (subscription) {
            await ctx.db.delete(subscription._id);
        }
    },
});
