import { action } from "./_generated/server";
import { v } from "convex/values";
import sharp from "sharp";
import { getDescopeUserId } from "./lib/auth";
import {
    r2,
    toR2Reference,
    makeProfileImageKey,
    makeListingImageKey
} from "./r2";

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
        const userId = await getDescopeUserId(ctx as any);
        if (!userId) {
            throw new Error("Authentication required to upload profile image");
        }

        // Convert base64 to Buffer
        const base64WithoutPrefix = args.base64Data.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64WithoutPrefix, 'base64');

        const key = makeProfileImageKey(userId);

        // Optimize profile image: Resize to 400x400 cover, WebP
        const processedBuffer = await sharp(buffer)
            .resize(400, 400, { fit: 'cover' })
            .webp({ quality: 80 })
            .toBuffer();

        await r2.store(ctx, processedBuffer, { key, type: 'image/webp' });

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
        const userId = await getDescopeUserId(ctx as any);
        if (!userId) {
            throw new Error("Authentication required to upload listing image");
        }

        // Convert base64 to Buffer
        const base64WithoutPrefix = args.base64Data.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64WithoutPrefix, 'base64');

        const baseKey = makeListingImageKey(args.postId);

        // Process variants
        const image = sharp(buffer);
        const metadata = await image.metadata();

        // Define variants
        const variants = [
            { name: 'small', width: 400 },
            { name: 'medium', width: 800 },
            { name: 'large', width: 1200 },
        ];

        // Upload original (optimized as WebP)
        const originalBuffer = await image
            .webp({ quality: 80 })
            .toBuffer();

        await r2.store(ctx, originalBuffer, { key: baseKey, type: 'image/webp' });

        // Upload variants
        await Promise.all(variants.map(async (variant) => {
            // Only generate larger variants if original is large enough
            if (metadata.width && metadata.width < variant.width) return;

            const variantBuffer = await image
                .resize(variant.width, null, { withoutEnlargement: true })
                .webp({ quality: 80 })
                .toBuffer();

            await r2.store(ctx, variantBuffer, {
                key: `${baseKey}_${variant.name}`,
                type: 'image/webp'
            });
        }));

        return toR2Reference(baseKey);
    },
});
