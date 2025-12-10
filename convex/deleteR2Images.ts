import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";

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
 * Internal action to delete an image from R2
 * Called asynchronously when deleting ads
 */
export const deleteR2Image = internalAction({
  args: {
    key: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const command = new DeleteObjectCommand({
        Bucket: process.env.R2_BUCKET!,
        Key: args.key,
      });

      await s3Client.send(command);
      console.log(`Successfully deleted R2 image: ${args.key}`);
    } catch (error) {
      console.error(`Failed to delete R2 image ${args.key}:`, error);
      // Don't throw - we don't want to fail the ad deletion if image cleanup fails
    }
  },
});
