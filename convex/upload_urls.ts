"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { makeProfileImageKey, makeListingImageKey, toR2Reference } from "./r2";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Helper to get authenticated user ID
async function getUserId(ctx: any) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
        throw new Error("Authentication required");
    }

    const user = await ctx.runQuery(internal.users.getUserByToken, { token: identity.subject });
    if (!user) {
        throw new Error("User not found");
    }

    return user._id;
}

// Initialize S3 client for R2
const s3Client = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT!,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
});

/**
 * Generate presigned URL for profile image upload
 * Uses makeProfileImageKey to ensure proper folder structure: profiles/{userId}/{uuid}
 */
export const generateProfileUploadUrl = action({
    args: {},
    handler: async (ctx) => {
        const userId = await getUserId(ctx);

        // Generate key with proper folder structure
        const key = makeProfileImageKey(userId);

        // Generate presigned URL for PUT operation
        const command = new PutObjectCommand({
            Bucket: process.env.R2_BUCKET!,
            Key: key,
            ContentType: "image/webp",
        });

        const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

        return {
            url,
            key: toR2Reference(key)
        };
    },
});

/**
 * Generate presigned URL for listing image upload
 * Uses makeListingImageKey to ensure proper folder structure: flyers/{postId}/{uuid}
 */
export const generateListingUploadUrl = action({
    args: {
        postId: v.string(),
    },
    handler: async (ctx, args) => {
        const userId = await getUserId(ctx);

        // Generate key with proper folder structure
        const key = makeListingImageKey(args.postId);

        // Generate presigned URL for PUT operation
        const command = new PutObjectCommand({
            Bucket: process.env.R2_BUCKET!,
            Key: key,
            ContentType: "image/webp",
        });

        const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

        return {
            url,
            key: toR2Reference(key)
        };
    },
});
