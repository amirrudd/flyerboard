import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { isR2Reference, r2, toR2Reference } from "./r2";
import { APP_SETTING_SPECS } from "./lib/appConfig";

const DEFAULT_BATCH_SIZE = 10;

const needsMigration = (value: string | null | undefined) =>
  Boolean(value && !value.startsWith("http") && !value.startsWith("data:") && !isR2Reference(value));

const makeAdKey = (ad: Pick<Doc<"ads">, "_id" | "userId">, _index: number) =>
  `flyers/${ad._id}/${crypto.randomUUID()}`;

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

        const payload = await toUint8Array(file);
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

      const payload = await toUint8Array(file);
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

/**
 * Update category names and add Baby & Kids category
 * - Rename "Temporary Hire" to "Gigs & Temp Work"
 * - Rename "Rent & Hire" to "Equipment Rental"
 * - Add new "Baby & Kids" category
 * Run this once to update existing database
 */
export const updateCategoryNames = internalMutation({
  args: {},
  handler: async (ctx) => {
    const updates = [];
    const added = [];

    // Rename "Temporary Hire" to "Gigs & Temp Work"
    const temporaryHire = await ctx.db
      .query("categories")
      .withIndex("by_slug", (q) => q.eq("slug", "temporary-hire"))
      .first();

    if (temporaryHire) {
      await ctx.db.patch(temporaryHire._id, {
        name: "Gigs & Temp Work",
        slug: "gigs-temp-work",
      });
      updates.push({ old: "Temporary Hire", new: "Gigs & Temp Work" });
    }

    // Rename "Rent & Hire" to "Equipment Rental"
    const rentHire = await ctx.db
      .query("categories")
      .withIndex("by_slug", (q) => q.eq("slug", "rent-hire"))
      .first();

    if (rentHire) {
      await ctx.db.patch(rentHire._id, {
        name: "Equipment Rental",
        slug: "equipment-rental",
      });
      updates.push({ old: "Rent & Hire", new: "Equipment Rental" });
    }

    // Add "Baby & Kids" category if it doesn't exist
    const babyKids = await ctx.db
      .query("categories")
      .withIndex("by_slug", (q) => q.eq("slug", "baby-kids"))
      .first();

    if (!babyKids) {
      const id = await ctx.db.insert("categories", {
        name: "Baby & Kids",
        slug: "baby-kids",
        icon: "Baby",
      });
      added.push({ id, name: "Baby & Kids" });
    }

    return {
      success: true,
      message: `Updated ${updates.length} categories, added ${added.length} new categories`,
      updated: updates,
      added: added,
    };
  },
});

/**
 * Backfill existing ads with listingType: "sale"
 * This ensures all existing ads have a consistent listingType value
 * Run this once after deploying the exchange feature
 * 
 * Usage: npx convex run migrations:backfillListingType
 */
export const backfillListingType = internalMutation({
  args: {
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const batchSize = args.batchSize ?? 100;

    // Find ads without listingType
    const adsToUpdate = await ctx.db
      .query("ads")
      .filter((q) => q.eq(q.field("listingType"), undefined))
      .take(batchSize);

    let updated = 0;
    for (const ad of adsToUpdate) {
      await ctx.db.patch(ad._id, {
        listingType: "sale",
      });
      updated++;
    }

    const remaining = await ctx.db
      .query("ads")
      .filter((q) => q.eq(q.field("listingType"), undefined))
      .take(1);

    return {
      success: true,
      message: `Updated ${updated} ads with listingType: "sale"`,
      updated,
      hasMore: remaining.length > 0,
      note: remaining.length > 0 ? "Run again to process more ads" : "All ads have been updated",
    };
  },
});

/**
 * Add Hobbies & Collectibles category if it doesn't exist
 * Run this once after deploying the exchange feature
 * 
 * Usage: npx convex run migrations:addHobbiesCategory
 */
export const addHobbiesCategory = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Check if category already exists
    const existing = await ctx.db
      .query("categories")
      .withIndex("by_slug", (q) => q.eq("slug", "hobbies-collectibles"))
      .first();

    if (existing) {
      return {
        success: true,
        message: "Hobbies & Collectibles category already exists",
        categoryId: existing._id,
        created: false,
      };
    }

    // Create the category
    const categoryId = await ctx.db.insert("categories", {
      name: "Hobbies & Collectibles",
      slug: "hobbies-collectibles",
      icon: "Gamepad2",
    });

    return {
      success: true,
      message: "Created Hobbies & Collectibles category",
      categoryId,
      created: true,
    };
  },
});

/**
 * Ensure all canonical categories exist and have correct names/icons.
 * This is safe to run multiple times (idempotent).
 * 
 * Usage: npx convex run migrations:ensureAllCategories
 */
export const ensureAllCategories = internalMutation({
  args: {},
  handler: async (ctx) => {
    const canonicalCategories = [
      { name: "Vehicles", slug: "vehicles", icon: "Car" },
      { name: "Real Estate", slug: "real-estate", icon: "Home" },
      { name: "Electronics", slug: "electronics", icon: "Smartphone" },
      { name: "Home & Garden", slug: "home-garden", icon: "Armchair" },
      { name: "Services", slug: "services", icon: "Wrench" },
      { name: "Fashion", slug: "fashion", icon: "Shirt" },
      { name: "Sports & Recreation", slug: "sports", icon: "Dumbbell" },
      { name: "Gigs & Temp Work", slug: "gigs-temp-work", icon: "Briefcase" },
      { name: "Personal Items", slug: "personal-items", icon: "Watch" },
      { name: "Books & Media", slug: "books-media", icon: "Book" },
      { name: "Pets & Animals", slug: "pets-animals", icon: "PawPrint" },
      { name: "Art", slug: "art", icon: "Palette" },
      { name: "Equipment Rental", slug: "equipment-rental", icon: "CalendarClock" },
      { name: "Baby & Kids", slug: "baby-kids", icon: "Baby" },
      { name: "Hobbies & Collectibles", slug: "hobbies-collectibles", icon: "Gamepad2" },
    ];

    const results = {
      added: [] as string[],
      updated: [] as string[],
      legacy: [] as string[],
    };

    // First, handle legacy renames based on old slugs
    const legacyMappings = [
      { oldSlug: "temporary-hire", newSlug: "gigs-temp-work" },
      { oldSlug: "rent-hire", newSlug: "equipment-rental" },
    ];

    for (const mapping of legacyMappings) {
      const existingLegacy = await ctx.db
        .query("categories")
        .withIndex("by_slug", (q) => q.eq("slug", mapping.oldSlug))
        .first();

      if (existingLegacy) {
        // Find existing new slug if any (to avoid conflict)
        const targetExist = await ctx.db
          .query("categories")
          .withIndex("by_slug", (q) => q.eq("slug", mapping.newSlug))
          .first();

        if (!targetExist) {
          await ctx.db.patch(existingLegacy._id, { slug: mapping.newSlug });
          results.legacy.push(`${mapping.oldSlug} -> ${mapping.newSlug}`);
        }
      }
    }

    // Now ensure all canonical categories are correct
    for (const cat of canonicalCategories) {
      const existing = await ctx.db
        .query("categories")
        .withIndex("by_slug", (q) => q.eq("slug", cat.slug))
        .first();

      if (existing) {
        // Update if name or icon changed
        if (existing.name !== cat.name || existing.icon !== cat.icon) {
          await ctx.db.patch(existing._id, {
            name: cat.name,
            icon: cat.icon,
          });
          results.updated.push(cat.name);
        }
      } else {
        // Create missing category
        await ctx.db.insert("categories", cat);
        results.added.push(cat.name);
      }
    }

    return {
      success: true,
      results,
    };
  },
});

/**
 * Seed default feature flags.
 * This is safe to run multiple times (idempotent) - it only creates flags that don't exist.
 * 
 * Usage: npx convex run migrations:seedFeatureFlags
 */
export const seedFeatureFlags = internalMutation({
  args: {},
  handler: async (ctx) => {
    const defaultFlags = [
      {
        key: "identityVerification",
        description: "Allow users to self-verify their identity from their dashboard",
        enabled: true,
      },
      {
        key: "movingSaleMode",
        description: "Moving Sale Mode — bulk-list flow, public sale pages, dashboard sales tab, and feed sale cards. Disabling hides every entry point (safety kill switch), it does not delete existing sales.",
        enabled: true,
      },
      {
        key: "bundleListing",
        description: "Bundle Listing — group a few standalone ads at a discount. Gates the dashboard 'Bundle ads' button, the ad-detail bundle banner, and feed bundle cards. Disabling hides every entry point (safety kill switch), it does not delete existing bundles.",
        enabled: true,
      },
      {
        key: "boostToTop",
        description: "Boost ('push to top') — lets an ad's owner re-stamp its feed position back to the top after a cooldown. Gates the dashboard + ad-detail Boost CTAs and is re-checked server-side in the boostAd mutation (fail closed). Ships DISABLED — flip when ready.",
        enabled: false,
      },
    ];

    const results = {
      created: [] as string[],
      existing: [] as string[],
    };

    for (const flag of defaultFlags) {
      const existing = await ctx.db
        .query("featureFlags")
        .withIndex("by_key", (q) => q.eq("key", flag.key))
        .first();

      if (existing) {
        results.existing.push(flag.key);
      } else {
        await ctx.db.insert("featureFlags", flag);
        results.created.push(flag.key);
      }
    }

    return {
      success: true,
      message: `Created ${results.created.length} flags, ${results.existing.length} already existed`,
      results,
    };
  },
});

/**
 * Seed default numeric app settings from the registry in convex/lib/appConfig.ts
 * (boost, bundle, sale, and feed knobs). Rate-limit overrides (`rateLimitMax_<op>`)
 * are deliberately NOT seeded — a missing row means "use the static default"; the
 * admin tab creates a row on demand when an op is overridden (sparse-row convention).
 * Idempotent — only creates keys that don't already exist; never overwrites an
 * admin-tuned value. Mirrors seedFeatureFlags.
 *
 * Usage: npx convex run migrations:seedAppSettings
 */
export const seedAppSettings = internalMutation({
  args: {},
  handler: async (ctx) => {
    const defaultSettings = APP_SETTING_SPECS.filter((s) => s.seed).map((s) => ({
      key: s.key,
      value: s.defaultValue,
      description: s.description,
    }));

    const results = {
      created: [] as string[],
      existing: [] as string[],
    };

    for (const setting of defaultSettings) {
      const existing = await ctx.db
        .query("appSettings")
        .withIndex("by_key", (q) => q.eq("key", setting.key))
        .first();

      if (existing) {
        results.existing.push(setting.key);
      } else {
        await ctx.db.insert("appSettings", setting);
        results.created.push(setting.key);
      }
    }

    return {
      success: true,
      message: `Created ${results.created.length} settings, ${results.existing.length} already existed`,
      results,
    };
  },
});

/**
 * Backfill `sellerId` and `status` on `saleBundles` rows that predate Bundle
 * Listing (Moving Sale Mode shipped the table without them). Idempotent — safe to
 * run repeatedly; only touches rows missing a field.
 *
 * `sellerId` is derived from the owning sale event (`saleEvent.userId`). Rows with
 * neither a `sellerId` nor a resolvable `saleEventId` are reported as orphans and
 * left untouched (should not exist in practice).
 *
 * Usage: npx convex run migrations:backfillSaleBundles
 */
export const backfillSaleBundles = internalMutation({
  args: {},
  handler: async (ctx) => {
    const bundles = await ctx.db.query("saleBundles").collect();
    const results = { patched: 0, skipped: 0, orphaned: [] as string[] };

    for (const bundle of bundles) {
      const patch: { sellerId?: (typeof bundle)["sellerId"]; status?: "active" } = {};

      if (!bundle.sellerId) {
        if (bundle.saleEventId) {
          const sale = await ctx.db.get(bundle.saleEventId);
          if (sale) patch.sellerId = sale.userId;
        }
        if (!patch.sellerId) {
          results.orphaned.push(bundle._id);
          continue;
        }
      }
      if (!bundle.status) patch.status = "active";

      if (Object.keys(patch).length > 0) {
        await ctx.db.patch(bundle._id, patch);
        results.patched += 1;
      } else {
        results.skipped += 1;
      }
    }

    return {
      success: true,
      message: `Patched ${results.patched}, skipped ${results.skipped}, orphaned ${results.orphaned.length}`,
      results,
    };
  },
});

/**
 * Backfill `bumpedAt` on ads that predate the Boost feature (Phase 1A).
 *
 * `bumpedAt` is the mutable feed sort key (see `convex/lib/boost.ts` +
 * `schema.ts`). Legacy rows have it undefined; this stamps
 * `bumpedAt = _creationTime` so each ad's feed position is unchanged when Phase 1B
 * switches the feed sort from `_creationTime` to `bumpedAt`.
 *
 * Idempotent — only touches rows where `bumpedAt === undefined`, so re-running is
 * safe. Batched with a cap (per `imageCleanup.ts`): each run processes up to
 * `batchSize` rows NEWEST-FIRST (`.order("desc")` = by `_creationTime` desc).
 * Newest-first is load-bearing: mid-run, already-backfilled values rank above
 * still-undefined rows under the future sort, so the visible top of the feed stays
 * correct throughout (oldest-first would surface old ads on page 1 mid-migration).
 * Re-run until `remaining === 0` (`done === true`).
 *
 * Usage: npx convex run migrations:backfillBumpedAt
 */
export const backfillBumpedAt = internalMutation({
  args: { batchSize: v.optional(v.number()) },
  returns: v.object({
    processed: v.number(),
    remaining: v.number(),
    done: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const batchSize = args.batchSize ?? 200;

    // Newest-first scan (default index is by _creationTime), filtering to rows that
    // still need backfilling.
    const pending = await ctx.db
      .query("ads")
      .order("desc")
      .filter((q) => q.eq(q.field("bumpedAt"), undefined))
      .take(batchSize);

    for (const ad of pending) {
      await ctx.db.patch(ad._id, { bumpedAt: ad._creationTime });
    }

    // Best-effort remaining count (bounded scan) so repeated runs can be watched
    // trending to zero; `done` is the precise "nothing left to backfill" signal.
    const REMAINING_SCAN_CAP = 10000;
    const stillPending = await ctx.db
      .query("ads")
      .filter((q) => q.eq(q.field("bumpedAt"), undefined))
      .take(REMAINING_SCAN_CAP);
    const remaining = stillPending.length;

    return { processed: pending.length, remaining, done: remaining === 0 };
  },
});

// `backfillFeedBumpedAt` (unified-feed bumpedAt backfill) was deleted after it
// ran to completion on prod (2026-07-19) and the composites' `bumpedAt`
// validators were narrowed to v.number() — it could no longer compile (or run)
// against the narrowed schema. If a deployment still has legacy rows, run the
// migration from a pre-narrow commit BEFORE deploying the narrowed schema.

/**
 * Rename feature flag key from userSelfVerification to identityVerification
 * Run this once to update existing database
 *
 * Usage: npx convex run migrations:renameFeatureFlag
 */
export const renameFeatureFlag = internalMutation({
  args: {},
  handler: async (ctx) => {
    const oldFlag = await ctx.db
      .query("featureFlags")
      .withIndex("by_key", (q) => q.eq("key", "userSelfVerification"))
      .first();

    if (!oldFlag) {
      return {
        success: true,
        message: "No flag with key 'userSelfVerification' found. Nothing to rename.",
        renamed: false,
      };
    }

    // Check if new key already exists
    const newFlag = await ctx.db
      .query("featureFlags")
      .withIndex("by_key", (q) => q.eq("key", "identityVerification"))
      .first();

    if (newFlag) {
      // Delete the old one since new one already exists
      await ctx.db.delete(oldFlag._id);
      return {
        success: true,
        message: "Deleted old 'userSelfVerification' flag (new 'identityVerification' already exists)",
        renamed: false,
        deleted: true,
      };
    }

    // Rename by patching the key
    await ctx.db.patch(oldFlag._id, { key: "identityVerification" });

    return {
      success: true,
      message: "Renamed 'userSelfVerification' to 'identityVerification'",
      renamed: true,
    };
  },
});
