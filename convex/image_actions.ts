"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
    r2,
    toR2Reference,
    makeProfileImageKey,
    makeListingImageKey
} from "./r2";

// Helper to get user ID with local dev fallback
async function getUserId(ctx: any) {
    // Check if we're in local development
    const isDev = process.env.CONVEX_CLOUD_URL?.includes("convex.cloud") === false;

    if (isDev) {
        // In local dev, just use the most recent user
        const recentUser = await ctx.runQuery(internal.users.getMostRecentUser);
        if (recentUser) return recentUser._id;
        throw new Error("No users found in database. Please log in at least once before uploading images.");
    }

    // In production, require proper authentication
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
        throw new Error("Authentication required to upload images");
    }

    const user = await ctx.runQuery(internal.users.getUserByToken, { token: identity.subject });
    if (!user) {
        throw new Error("User not found");
    }

    return user._id;
}

/**
 * Upload a profile image with proper folder structure
 * Generates key: profiles/{userId}/{randomUUID}
 */
export const uploadProfileImage = action({
    args: {
        base64Data: v.string(),
        contentType: v.string(),
    },
    handler: async (ctx, args) => {
        const userId = await getUserId(ctx);
        if (!userId) {
            throw new Error("Authentication required to upload profile image");
        }

        // Convert base64 to Buffer
        const base64WithoutPrefix = args.base64Data.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64WithoutPrefix, 'base64');

        const key = makeProfileImageKey(userId);

        // Store original image
        await r2.store(ctx, buffer, { key, type: args.contentType });

        return toR2Reference(key);
    },
});

/**
 * Upload a listing image with proper folder structure
 * Generates key: flyers/{postId}/{randomUUID}
 */
export const uploadListingImage = action({
    args: {
        postId: v.string(),
        base64Data: v.string(),
        contentType: v.string(),
    },
    handler: async (ctx, args) => {
        const userId = await getUserId(ctx);
        if (!userId) {
            throw new Error("Authentication required to upload listing image");
        }

        // Convert base64 to Buffer
        const base64WithoutPrefix = args.base64Data.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64WithoutPrefix, 'base64');

        const baseKey = makeListingImageKey(args.postId);

        // Store original image
        await r2.store(ctx, buffer, { key: baseKey, type: args.contentType });

        return toR2Reference(baseKey);
    },
});
