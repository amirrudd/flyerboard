import { R2 } from "@convex-dev/r2";
import { components } from "./_generated/api";
import { getDescopeUserId } from "./lib/auth";
import { action } from "./_generated/server";
import { v } from "convex/values";

export const R2_REFERENCE_PREFIX = "r2:";

export const toR2Reference = (key: string) => `${R2_REFERENCE_PREFIX}${key}`;
export const fromR2Reference = (reference: string) =>
  reference.slice(R2_REFERENCE_PREFIX.length);
export const isR2Reference = (value: string | null | undefined) =>
  typeof value === "string" && value.startsWith(R2_REFERENCE_PREFIX);

/**
 * Generate a unique key for a profile image
 * Format: profiles/{userId}/{randomUUID}
 */
export const makeProfileImageKey = (userId: string) =>
  `profiles/${userId}/${crypto.randomUUID()}`;

/**
 * Generate a unique key for a listing image
 * Format: flyers/{postId}/{randomUUID}
 */
export const makeListingImageKey = (postId: string) =>
  `flyers/${postId}/${crypto.randomUUID()}`;

const r2 = new R2(components.r2);

export const {
  generateUploadUrl,
  syncMetadata,
  getMetadata,
  listMetadata,
  deleteObject,
  onSyncMetadata,
} = r2.clientApi({
  /**
   * Verify user is authenticated before allowing R2 uploads
   */
  checkUpload: async (ctx, bucket) => {
    const userId = await getDescopeUserId(ctx as any);
    if (!userId) {
      throw new Error("Authentication required. Please log in to upload files.");
    }
  },

  /**
   * Track successful uploads in the database
   */
  onUpload: async (ctx, bucket, key) => {
    const userId = await getDescopeUserId(ctx as any);
    if (!userId) {
      console.error("Upload completed but user not authenticated - this should not happen");
      return;
    }

    // Record upload in database for audit trail
    await ctx.db.insert("uploads", {
      key,
      userId,
      bucket,
      uploadedAt: Date.now(),
    });

    // Only log in development mode
    const isDev = process.env.CONVEX_CLOUD_URL?.includes("convex.cloud") === false;
    if (isDev) {
      console.log(`R2 Upload tracked: ${key} by user ${userId}`);
    }
  },
});

export { r2 };
