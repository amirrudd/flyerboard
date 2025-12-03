import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getDescopeUserId } from "./lib/auth";

/**
 * Syncs a Descope user to the Convex users table.
 * This should be called on the frontend after a successful Descope login.
 */
export const syncDescopeUser = mutation({
    args: {
        email: v.optional(v.string()),
        name: v.optional(v.string()),
        phone: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            // In local development, OIDC might not work properly
            // Return early instead of throwing
            console.warn("syncDescopeUser: No identity found (local development mode?)");
            return null;
        }

        // The subject is the unique identifier from Descope (e.g., "descope|user123")
        const subject = identity.subject;

        // Check if user already exists by tokenIdentifier
        const existingUser = await ctx.db
            .query("users")
            .filter((q) => q.eq(q.field("tokenIdentifier"), subject))
            .first();

        if (existingUser) {
            // User exists, optionally update their info
            const updates: any = {};
            if (args.email && args.email !== existingUser.email) {
                updates.email = args.email;
            }
            if (args.name && args.name !== existingUser.name) {
                updates.name = args.name;
            }

            if (Object.keys(updates).length > 0) {
                await ctx.db.patch(existingUser._id, updates);
            }

            return existingUser._id;
        }

        // Create new user
        const userId = await ctx.db.insert("users", {
            tokenIdentifier: subject,
            email: args.email,
            name: args.name || args.email?.split("@")[0] || "User",
            // Optional fields from your schema
            image: undefined,
            totalRating: 0,
            ratingCount: 0,
            averageRating: 0,
            isVerified: false,
        });

        return userId;
    },
});



/**
 * Gets the current user, creating one if it doesn't exist.
 * This is a safer alternative to just using getAuthUserId.
 */
export const getCurrentUser = query({
    handler: async (ctx) => {
        const userId = await getDescopeUserId(ctx);
        if (!userId) {
            return null;
        }

        return await ctx.db.get(userId);
    },
});

/**
 * Gets the current user's ID, or null if not authenticated.
 * This replaces getAuthUserId for Descope authentication.
 */
export const getCurrentUserId = query({
    handler: async (ctx) => {
        return await getDescopeUserId(ctx);
    },
});
