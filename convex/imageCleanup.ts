import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { fromR2Reference, isR2Reference, r2 } from "./r2";
import { logOperation } from "./lib/logger";

// ── Retention policy ────────────────────────────────────────────────────
// Days a soft-deleted ad's images are kept in R2 before being purged.
// Override via the IMAGE_CLEANUP_RETENTION_DAYS env var, or per-invocation
// via the `retentionDays` arg (useful for manual runs, e.g.
// `npx convex run imageCleanup:purgeDeletedAdImages '{"retentionDays": 7}'`).
const DEFAULT_RETENTION_DAYS = 30;
const MIN_RETENTION_DAYS = 1;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Batch caps per run, to keep each invocation within Convex action limits.
const PURGE_BATCH_SIZE = 50;
const BACKFILL_BATCH_SIZE = 200;

function resolveRetentionDays(override?: number): number {
  const envValue = parseInt(process.env.IMAGE_CLEANUP_RETENTION_DAYS ?? "", 10);
  const base = override ?? (Number.isFinite(envValue) ? envValue : DEFAULT_RETENTION_DAYS);
  return Math.max(MIN_RETENTION_DAYS, Math.floor(base));
}

// ── Queries ──────────────────────────────────────────────────────────────

/**
 * Ads that are soft-deleted, past their retention window, and still have
 * images to purge. Uses the `by_deleted` index to narrow to deleted ads
 * before filtering on deletedAt/imagesPurgedAt/images in memory.
 */
export const listAdsReadyForPurge = internalQuery({
  args: {
    cutoff: v.number(),
    limit: v.number(),
  },
  returns: v.array(v.id("ads")),
  handler: async (ctx, args) => {
    const candidates = await ctx.db
      .query("ads")
      .withIndex("by_deleted", (q) => q.eq("isDeleted", true))
      .collect();

    const ready: Id<"ads">[] = [];
    for (const ad of candidates) {
      if (ad.imagesPurgedAt !== undefined) continue;
      if (ad.deletedAt === undefined) continue;
      if (ad.deletedAt >= args.cutoff) continue;
      if (!ad.images || ad.images.length === 0) continue;
      ready.push(ad._id);
      if (ready.length >= args.limit) break;
    }
    return ready;
  },
});

/**
 * Soft-deleted ads with no `deletedAt` (deleted before this feature shipped).
 * Their retention clock starts now — they get stamped, not purged, this run.
 */
export const listAdsNeedingDeletedAtBackfill = internalQuery({
  args: {
    limit: v.number(),
  },
  returns: v.array(v.id("ads")),
  handler: async (ctx, args) => {
    const candidates = await ctx.db
      .query("ads")
      .withIndex("by_deleted", (q) => q.eq("isDeleted", true))
      .collect();

    const pending: Id<"ads">[] = [];
    for (const ad of candidates) {
      if (ad.deletedAt !== undefined) continue;
      pending.push(ad._id);
      if (pending.length >= args.limit) break;
    }
    return pending;
  },
});

export const getAdForPurge = internalQuery({
  args: { adId: v.id("ads") },
  returns: v.union(
    v.object({
      _id: v.id("ads"),
      images: v.array(v.string()),
      isDeleted: v.optional(v.boolean()),
      imagesPurgedAt: v.optional(v.number()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const ad = await ctx.db.get(args.adId);
    if (!ad) return null;
    return {
      _id: ad._id,
      images: ad.images,
      isDeleted: ad.isDeleted,
      imagesPurgedAt: ad.imagesPurgedAt,
    };
  },
});

// ── Mutations ────────────────────────────────────────────────────────────

export const stampDeletedAt = internalMutation({
  args: { adId: v.id("ads") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const ad = await ctx.db.get(args.adId);
    if (!ad || ad.deletedAt !== undefined) return null;
    await ctx.db.patch(args.adId, { deletedAt: Date.now() });
    return null;
  },
});

/**
 * Mark an ad's images as purged. Keeps `isDeleted: true` and the ad row
 * itself — never hard-delete an ad.
 */
export const markImagesPurged = internalMutation({
  args: { adId: v.id("ads") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.adId, {
      images: [],
      imagesPurgedAt: Date.now(),
    });
    return null;
  },
});

// ── Action ───────────────────────────────────────────────────────────────

const purgeSummaryValidator = v.object({
  adsPurged: v.number(),
  objectsDeleted: v.number(),
  failures: v.number(),
  backfilled: v.number(),
  adsRemaining: v.number(),
  retentionDays: v.number(),
});

/**
 * Retention-policy-driven cleanup of soft-deleted ads' images.
 *
 * - Purges images for ads deleted more than `retentionDays` ago (capped at
 *   PURGE_BATCH_SIZE per run).
 * - Backfills `deletedAt` for ads soft-deleted before this feature existed
 *   (capped at BACKFILL_BATCH_SIZE per run); these are NOT purged this run —
 *   their retention clock starts today.
 *
 * Manual invocation with a custom policy:
 *   npx convex run imageCleanup:purgeDeletedAdImages '{"retentionDays": 7}'
 */
export const purgeDeletedAdImages = internalAction({
  args: {
    retentionDays: v.optional(v.number()),
  },
  returns: purgeSummaryValidator,
  handler: async (ctx, args) => {
    const retentionDays = resolveRetentionDays(args.retentionDays);
    const cutoff = Date.now() - retentionDays * MS_PER_DAY;

    // Backfill pass: stamp deletedAt for legacy soft-deleted ads. They are
    // intentionally excluded from purging this run.
    const backfillIds: Id<"ads">[] = await ctx.runQuery(
      internal.imageCleanup.listAdsNeedingDeletedAtBackfill,
      { limit: BACKFILL_BATCH_SIZE }
    );
    for (const adId of backfillIds) {
      await ctx.runMutation(internal.imageCleanup.stampDeletedAt, { adId });
    }

    // Purge pass: ads past retention with images still present.
    const purgeIds: Id<"ads">[] = await ctx.runQuery(internal.imageCleanup.listAdsReadyForPurge, {
      cutoff,
      limit: PURGE_BATCH_SIZE,
    });

    let adsPurged = 0;
    let objectsDeleted = 0;
    let failures = 0;

    for (const adId of purgeIds) {
      const ad = await ctx.runQuery(internal.imageCleanup.getAdForPurge, { adId });
      if (!ad || ad.imagesPurgedAt !== undefined) continue;

      for (const imageRef of ad.images) {
        try {
          if (!imageRef) continue;

          if (imageRef.startsWith("http://") || imageRef.startsWith("https://") || imageRef.startsWith("data:")) {
            // External reference — nothing stored in R2/Convex storage to delete.
            continue;
          }

          if (isR2Reference(imageRef)) {
            const key = fromR2Reference(imageRef);
            await r2.deleteObject(ctx, key);
            objectsDeleted++;
            continue;
          }

          if (
            imageRef.startsWith("flyers/") ||
            imageRef.startsWith("profiles/") ||
            imageRef.startsWith("ad/")
          ) {
            // Legacy raw R2 key (no r2: prefix).
            await r2.deleteObject(ctx, imageRef);
            objectsDeleted++;
            continue;
          }

          if (!imageRef.includes("/")) {
            // Legacy Convex storage ID.
            try {
              await ctx.storage.delete(imageRef as Id<"_storage">);
              objectsDeleted++;
            } catch (storageErr) {
              // Tolerate already-deleted storage objects.
              logOperation("imageCleanup: storage.delete failed (tolerated)", {
                adId,
                imageRef,
                error: storageErr instanceof Error ? storageErr.message : String(storageErr),
              });
            }
            continue;
          }

          // Unrecognized reference shape — skip rather than guess.
          logOperation("imageCleanup: unrecognized image ref, skipped", { adId, imageRef });
        } catch (err) {
          failures++;
          logOperation("imageCleanup: failed to delete image", {
            adId,
            imageRef,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      await ctx.runMutation(internal.imageCleanup.markImagesPurged, { adId });
      adsPurged++;
    }

    // Re-query after this run's mutations have landed so `adsRemaining`
    // reflects the true backlog still awaiting purge (uncapped count would
    // require .collect() without a limit; a generous cap is a good enough
    // signal for "there's more work to do next run").
    const remainingAfter: Id<"ads">[] = await ctx.runQuery(internal.imageCleanup.listAdsReadyForPurge, {
      cutoff,
      limit: PURGE_BATCH_SIZE * 20,
    });

    const summary = {
      adsPurged,
      objectsDeleted,
      failures,
      backfilled: backfillIds.length,
      adsRemaining: remainingAfter.length,
      retentionDays,
    };

    logOperation("imageCleanup: purge run complete", summary);

    return summary;
  },
});
