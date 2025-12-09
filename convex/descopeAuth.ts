import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getDescopeUserId } from "./lib/auth";

/**
 * Syncs a Descope user to the Convex users table.
 * This should be called on the frontend after a successful Descope login.
 * Note: Phone numbers from OTP signup are NOT stored for privacy protection.
 */
export const syncDescopeUser = mutation({
    args: {
        email: v.optional(v.string()),
        name: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            // In local development, OIDC might not check out if env vars aren't set
            // In Prod, this means Auth is misconfigured
            console.error("syncDescopeUser: No identity found. Check CONVEX_AUTH_ISSUER and DESCOPE_PROJECT_ID.");
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

        // Create new user with smart display name fallback
        // For OTP users without email/name, use generic "User" display name
        // Priority: name > email prefix > "User"
        let displayName = "User";
        if (args.name) {
            displayName = args.name;
        } else if (args.email) {
            displayName = args.email.split("@")[0];
        }

        const userId = await ctx.db.insert("users", {
            tokenIdentifier: subject,
            email: args.email,
            name: displayName,
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
