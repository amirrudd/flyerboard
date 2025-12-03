import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { isR2Reference, r2, toR2Reference } from "./r2";

const DEFAULT_BATCH_SIZE = 10;

const needsMigration = (value: string | null | undefined) =>
  Boolean(value && !value.startsWith("http") && !value.startsWith("data:") && !isR2Reference(value));

const makeAdKey = (ad: Pick<Doc<"ads">, "_id" | "userId">, index: number) =>
  `ads/${ad.userId}/${ad._id}_${index}_${crypto.randomUUID()}`;

const makeProfileKey = (userId: Id<"users">) => `profiles/${userId}/${crypto.randomUUID()}`;

type StoredFile = ArrayBuffer | Blob;
const toUint8Array = async (file: StoredFile) => {
  if (file instanceof ArrayBuffer) {
    return new Uint8Array(file);
  }
  return new Uint8Array(await file.arrayBuffer());
};

export const listAdsPendingR2 = internalQuery({
  args: { limit: v.number() },
  handler: async (ctx, args) => {
    const pending: Doc<"ads">[] = [];
    const ads = await ctx.db.query("ads").collect();
    for (const ad of ads) {
      if ((ad.images || []).some((image) => needsMigration(image))) {
        pending.push(ad);
      }
      if (pending.length >= args.limit) {
        break;
      }
    }
    return pending;
  },
});

export const updateAdImages = internalMutation({
  args: {
    adId: v.id("ads"),
    images: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.adId, { images: args.images });
  },
});

export const listUsersPendingR2 = internalQuery({
  args: { limit: v.number() },
  handler: async (ctx, args) => {
    const pending: Array<Pick<Doc<"users">, "_id" | "image">> = [];
    const users = await ctx.db.query("users").collect();
    for (const user of users) {
      if (needsMigration(user.image)) {
        pending.push({ _id: user._id, image: user.image });
      }
      if (pending.length >= args.limit) {
        break;
      }
    }
    return pending;
  },
});

export const updateUserImage = internalMutation({
  args: {
    userId: v.id("users"),
    image: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, { image: args.image });
  },
});

export const migrateLegacyImagesToR2 = internalAction({
  args: {
    batchSize: v.optional(v.number()),
    deleteLegacy: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const batchSize = args.batchSize ?? DEFAULT_BATCH_SIZE;
    const shouldDeleteLegacy = args.deleteLegacy ?? false;

    const adsToMigrate = await ctx.runQuery(internal.migrations.listAdsPendingR2, {
      limit: batchSize,
    });

    for (const ad of adsToMigrate) {
      const migratedImages: string[] = [];
      let changed = false;

      for (const [index, imageRef] of (ad.images || []).entries()) {
        if (!needsMigration(imageRef)) {
          migratedImages.push(imageRef);
          continue;
        }

        const file = imageRef
          ? await ctx.storage.get(imageRef as Id<"_storage">)
          : null;

        if (!file) {
          continue;
        }

        const payload = await toUint8Array(file as StoredFile);
        const key = await r2.store(ctx, payload, {
          key: makeAdKey(ad, index),
        });
        migratedImages.push(toR2Reference(key));
        changed = true;

        if (shouldDeleteLegacy && imageRef) {
          await ctx.storage.delete(imageRef as Id<"_storage">);
        }
      }

      if (changed) {
        await ctx.runMutation(internal.migrations.updateAdImages, {
          adId: ad._id,
          images: migratedImages,
        });
      }
    }

    const usersToMigrate = await ctx.runQuery(internal.migrations.listUsersPendingR2, {
      limit: batchSize,
    });

    for (const user of usersToMigrate) {
      if (!needsMigration(user.image) || !user.image) {
        continue;
      }

      const file = await ctx.storage.get(user.image as Id<"_storage">);
      if (!file) {
        continue;
      }

      const payload = await toUint8Array(file as StoredFile);
      const key = await r2.store(ctx, payload, {
        key: makeProfileKey(user._id),
      });

      await ctx.runMutation(internal.migrations.updateUserImage, {
        userId: user._id,
        image: toR2Reference(key),
      });

      if (shouldDeleteLegacy) {
        await ctx.storage.delete(user.image as Id<"_storage">);
      }
    }
  },
});
