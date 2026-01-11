import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getDescopeUserId } from "./lib/auth";
import { isValidEmail, normalizeEmail } from "./lib/emailUtils";

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

        // Normalize email (lowercase, trim, null if empty)
        const normalizedEmail = normalizeEmail(args.email);

        // Check if user already exists by tokenIdentifier
        const existingUser = await ctx.db
            .query("users")
            .filter((q) => q.eq(q.field("tokenIdentifier"), subject))
            .first();

        if (existingUser) {
            // User exists, optionally update their info
            const updates: any = {};

            // Handle email updates
            if (normalizedEmail !== null && normalizedEmail !== existingUser.email) {
                // Validate email format
                if (!isValidEmail(normalizedEmail)) {
                    throw new Error("Invalid email format");
                }

                // Check uniqueness before updating email on existing user
                const otherUser = await ctx.db
                    .query("users")
                    .withIndex("email", (q) => q.eq("email", normalizedEmail))
                    .first();

                if (otherUser && otherUser._id !== existingUser._id) {
                    throw new Error("Email already in use by another account");
                }
                updates.email = normalizedEmail;
            }

            if (args.name && args.name !== existingUser.name) {
                updates.name = args.name;
            }

            if (Object.keys(updates).length > 0) {
                await ctx.db.patch(existingUser._id, updates);
            }

            return existingUser._id;
        }

        // Check if user exists by email (to prevent duplicates)
        // Only check if email is provided (not null/empty)
        if (normalizedEmail !== null) {
            // Validate email format
            if (!isValidEmail(normalizedEmail)) {
                throw new Error("Invalid email format");
            }

            const existingUserByEmail = await ctx.db
                .query("users")
                .withIndex("email", (q) => q.eq("email", normalizedEmail))
                .first();

            if (existingUserByEmail) {
                // SECURITY: Do not automatically link accounts based on email.
                // This prevents account hijacking if the new auth method isn't verified.
                // The user must log in with their original method.
                console.error(`Preventing duplicate account creation for email ${normalizedEmail}`);
                throw new Error("An account with this email already exists. Please log in with your original account.");
            }
        }

        // Create new user with smart display name fallback
        // For OTP users without email/name, use generic "User" display name
        // Priority: name > email prefix > "User"
        let displayName = "User";
        if (args.name) {
            displayName = args.name;
        } else if (normalizedEmail) {
            displayName = normalizedEmail.split("@")[0];
        }

        const userId = await ctx.db.insert("users", {
            tokenIdentifier: subject,
            email: normalizedEmail || undefined,
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
 * Combined query for dashboard - returns user and stats in one call.
 * Reduces function invocations by combining getCurrentUser + getUserStats.
 */
export const getCurrentUserWithStats = query({
    handler: async (ctx) => {
        const userId = await getDescopeUserId(ctx);
        if (!userId) {
            return null;
        }

        const user = await ctx.db.get(userId);
        if (!user) {
            return null;
        }

        // Get user's ads for stats
        const ads = await ctx.db
            .query("ads")
            .withIndex("by_user", (q) => q.eq("userId", userId))
            .filter((q) => q.neq(q.field("isDeleted"), true))
            .collect();

        const activeAds = ads.filter(ad => ad.isActive).length;
        const totalViews = ads.reduce((sum, ad) => sum + ad.views, 0);

        // Get saved ads count
        const savedAds = await ctx.db
            .query("savedAds")
            .withIndex("by_user", (q) => q.eq("userId", userId))
            .collect();

        // Get chats count
        const chats = await ctx.db
            .query("chats")
            .withIndex("by_seller", (q) => q.eq("sellerId", userId))
            .collect();

        return {
            user,
            stats: {
                totalAds: ads.length,
                activeAds,
                totalViews,
                savedAds: savedAds.length,
                chats: chats.length,
                averageRating: user.averageRating || 0,
                ratingCount: user.ratingCount || 0,
            },
        };
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
