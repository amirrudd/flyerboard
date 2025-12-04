import { R2 } from "@convex-dev/r2";
import { components } from "./_generated/api";
import { getDescopeUserId } from "./lib/auth";

export const R2_REFERENCE_PREFIX = "r2:";

export const toR2Reference = (key: string) => `${R2_REFERENCE_PREFIX}${key}`;
export const fromR2Reference = (reference: string) =>
  reference.slice(R2_REFERENCE_PREFIX.length);
export const isR2Reference = (value: string | null | undefined) =>
  typeof value === "string" && value.startsWith(R2_REFERENCE_PREFIX);

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

    console.log(`R2 Upload tracked: ${key} by user ${userId}`);
  },
});

export { r2 };
