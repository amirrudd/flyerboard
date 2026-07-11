import { query, mutation, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./lib/adminAuth";
import { logAdminAction } from "./lib/logger";
import { clampBoostSetting, isBoostSettingInRange } from "./lib/boost";

// ============================================================================
// APP SETTINGS (numeric, admin-tunable) — mirrors convex/featureFlags.ts
// featureFlags stores booleans; appSettings stores numbers. First consumers are
// the boost cooldown + daily cap (keys in convex/lib/boost.ts).
// ============================================================================

/**
 * Raw read of a setting's stored value by key. Shared by the public `getSetting`
 * query and by mutations (e.g. `boostAd`) that need the value server-side. Returns
 * the raw number or `null` if the key doesn't exist — callers apply clamping.
 */
export async function readSettingValue(
  ctx: QueryCtx | MutationCtx,
  key: string
): Promise<number | null> {
  const setting = await ctx.db
    .query("appSettings")
    .withIndex("by_key", (q) => q.eq("key", key))
    .first();
  return setting?.value ?? null;
}

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Get a specific setting by key (public — for app usage, e.g. the client boost
 * countdown). Returns the (clamped, for known boost keys) numeric value, or `null`
 * if the setting doesn't exist. Clamping on read means the client sees the same
 * bounded value the server enforces, so the countdown can never drift out of range.
 */
export const getSetting = query({
  args: { key: v.string() },
  returns: v.union(v.number(), v.null()),
  handler: async (ctx, args) => {
    const raw = await readSettingValue(ctx, args.key);
    if (raw === null) return null;
    return clampBoostSetting(args.key, raw);
  },
});

/**
 * Get all settings (admin-only). Backs the admin Settings tab.
 */
export const getAllSettings = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("appSettings"),
      _creationTime: v.number(),
      key: v.string(),
      value: v.number(),
      description: v.string(),
    })
  ),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.db.query("appSettings").collect();
  },
});

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Update a setting's value (admin-only). REJECTS (throws) out-of-range values for
 * known boost keys — an admin gets loud feedback rather than a silent clamp. Reads
 * still clamp as defense-in-depth (see `getSetting`). Requires the setting to exist
 * (seed it via `migrations:seedAppSettings` first), mirroring featureFlags.update.
 */
export const updateSetting = mutation({
  args: {
    key: v.string(),
    value: v.number(),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const adminUser = await requireAdmin(ctx);

    if (!isBoostSettingInRange(args.key, args.value)) {
      throw new Error(
        `Value ${args.value} is out of range for setting "${args.key}".`
      );
    }

    const setting = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();

    if (!setting) {
      throw new Error(`Setting "${args.key}" not found`);
    }

    await ctx.db.patch(setting._id, { value: args.value });

    logAdminAction("App setting updated", {
      adminId: adminUser,
      key: args.key,
      value: args.value,
      previousValue: setting.value,
    });

    return { success: true };
  },
});
