import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./lib/adminAuth";
import { logAdminAction } from "./lib/logger";

// ============================================================================
// FEATURE FLAGS QUERIES
// ============================================================================

/**
 * Get all feature flags (admin-only)
 */
export const getAllFeatureFlags = query({
    handler: async (ctx) => {
        await requireAdmin(ctx);
        return await ctx.db.query("featureFlags").collect();
    },
});

/**
 * Get a specific feature flag by key (public - for app usage)
 * Returns the enabled state, or false if the flag doesn't exist
 */
export const getFeatureFlag = query({
    args: { key: v.string() },
    handler: async (ctx, args) => {
        const flag = await ctx.db
            .query("featureFlags")
            .withIndex("by_key", (q) => q.eq("key", args.key))
            .first();

        return flag?.enabled ?? false;
    },
});

// ============================================================================
// FEATURE FLAGS MUTATIONS
// ============================================================================

/**
 * Create a new feature flag (admin-only)
 */
export const createFeatureFlag = mutation({
    args: {
        key: v.string(),
        description: v.string(),
        enabled: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const adminUser = await requireAdmin(ctx);

        // Check if flag already exists
        const existing = await ctx.db
            .query("featureFlags")
            .withIndex("by_key", (q) => q.eq("key", args.key))
            .first();

        if (existing) {
            throw new Error(`Feature flag "${args.key}" already exists`);
        }

        const flagId = await ctx.db.insert("featureFlags", {
            key: args.key,
            description: args.description,
            enabled: args.enabled ?? false,
        });

        logAdminAction("Feature flag created", {
            adminId: adminUser,
            key: args.key,
            enabled: args.enabled ?? false
        });

        return flagId;
    },
});

/**
 * Update a feature flag (admin-only)
 */
export const updateFeatureFlag = mutation({
    args: {
        key: v.string(),
        enabled: v.boolean(),
    },
    handler: async (ctx, args) => {
        const adminUser = await requireAdmin(ctx);

        const flag = await ctx.db
            .query("featureFlags")
            .withIndex("by_key", (q) => q.eq("key", args.key))
            .first();

        if (!flag) {
            throw new Error(`Feature flag "${args.key}" not found`);
        }

        await ctx.db.patch(flag._id, { enabled: args.enabled });

        logAdminAction("Feature flag updated", {
            adminId: adminUser,
            key: args.key,
            enabled: args.enabled,
            previousEnabled: flag.enabled
        });

        return { success: true };
    },
});

/**
 * Delete a feature flag (admin-only)
 */
export const deleteFeatureFlag = mutation({
    args: { key: v.string() },
    handler: async (ctx, args) => {
        const adminUser = await requireAdmin(ctx);

        const flag = await ctx.db
            .query("featureFlags")
            .withIndex("by_key", (q) => q.eq("key", args.key))
            .first();

        if (!flag) {
            throw new Error(`Feature flag "${args.key}" not found`);
        }

        await ctx.db.delete(flag._id);

        logAdminAction("Feature flag deleted", {
            adminId: adminUser,
            key: args.key
        });

        return { success: true };
    },
});
