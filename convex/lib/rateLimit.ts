import { internalMutation, MutationCtx } from "../_generated/server";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";
import {
    RATE_LIMITS,
    OVERRIDABLE_RATE_LIMIT_OPS,
    rateLimitSettingKey,
} from "./rateLimitConfig";
import { clampAppSetting } from "./appConfig";
import { readSettingValue } from "../appSettings";

/**
 * Rate limiting enforcement (sliding window over rows in the `uploads` table).
 *
 * The static limits DATA lives in `./rateLimitConfig.ts` (frontend-safe, so the
 * admin SettingsTab can render the same defaults). `checkRateLimit` additionally
 * honours an admin override per op: an appSettings row `rateLimitMax_<op>`
 * replaces `maxRequests` (clamped to [1, 4× static default]); the window is never
 * overridable. Missing row = static default.
 *
 * Note: This is an in-process rate limiter. For production scale,
 * consider using Convex's built-in rate limiting or external service.
 */

// Re-exported for existing importers/tests; the data itself lives in rateLimitConfig.
export { RATE_LIMITS };

/**
 * Checks if a user has exceeded their rate limit for an operation.
 * Uses the uploads table with a special key format for tracking.
 * 
 * @param ctx - Convex mutation context
 * @param userId - The user to check rate limit for
 * @param operation - The operation being performed (e.g., "createAd", "sendMessage")
 * @throws Error if rate limit is exceeded
 * 
 * @example
 * ```typescript
 * // In a mutation handler
 * await checkRateLimit(ctx, userId, "createAd");
 * // Proceed with operation if no error thrown
 * ```
 */
export async function checkRateLimit(
    ctx: MutationCtx,
    userId: Id<"users">,
    operation: string
): Promise<void> {
    const config = RATE_LIMITS[operation] || RATE_LIMITS.default;
    let maxRequests = config.maxRequests;
    if (OVERRIDABLE_RATE_LIMIT_OPS.includes(operation)) {
        const key = rateLimitSettingKey(operation);
        const raw = await readSettingValue(ctx, key);
        if (raw !== null) maxRequests = clampAppSetting(key, raw);
    }
    await checkRateLimitDynamic(ctx, userId, operation, maxRequests, config.windowMs);
}

/**
 * Like `checkRateLimit`, but the max and window are supplied by the caller instead
 * of read from the static `RATE_LIMITS` table. Reuses the exact same storage (a
 * `ratelimit:${userId}:${operation}` row per successful op in the `uploads` table)
 * and cleanup, so no new table is needed.
 *
 * Use this when the limit is runtime-configurable — e.g. the boost daily cap, which
 * is admin-tunable via `appSettings` and so cannot live in the compile-time table.
 * Pass the SAME `operation` string you'd use with `checkRateLimit` so the row key is
 * stable; do NOT also call `checkRateLimit` for the same operation in one mutation,
 * or you'll insert two rows per op and double-count.
 *
 * Transactional safety: a mutation that throws after this call rolls the inserted
 * row back, so only SUCCESSFUL operations consume budget.
 *
 * @throws Error if the user has hit `maxRequests` within `windowMs`.
 */
export async function checkRateLimitDynamic(
    ctx: MutationCtx,
    userId: Id<"users">,
    operation: string,
    maxRequests: number,
    windowMs: number
): Promise<void> {
    const now = Date.now();
    const windowStart = now - windowMs;

    // Query rate limit records for this user and operation
    // Using a composite key stored in the uploads table for simplicity
    // In production, consider a dedicated rateLimits table
    const rateLimitKey = `ratelimit:${userId}:${operation}`;

    // Count recent requests within the window
    const recentRequests = await ctx.db
        .query("uploads")
        .withIndex("by_key", (q) => q.eq("key", rateLimitKey))
        .filter((q) => q.gte(q.field("uploadedAt"), windowStart))
        .collect();

    if (recentRequests.length >= maxRequests) {
        const resetTime = Math.ceil((windowStart + windowMs - now) / 1000 / 60);
        throw new Error(
            `Rate limit exceeded for ${operation}. Please try again in ${resetTime} minute(s).`
        );
    }

    // Record this request
    await ctx.db.insert("uploads", {
        key: rateLimitKey,
        userId,
        bucket: "ratelimit",
        uploadedAt: now,
    });

    // Clean up old rate limit records (older than 2x window to be safe)
    const oldRecords = await ctx.db
        .query("uploads")
        .withIndex("by_key", (q) => q.eq("key", rateLimitKey))
        .filter((q) => q.lt(q.field("uploadedAt"), windowStart - windowMs))
        .collect();

    for (const record of oldRecords) {
        await ctx.db.delete(record._id);
    }
}

/**
 * Internal mutation wrapper so actions can enforce rate limits.
 * Actions can't access MutationCtx directly; they call this via ctx.runMutation.
 */
export const enforceRateLimit = internalMutation({
    args: {
        userId: v.id("users"),
        operation: v.string(),
    },
    handler: async (ctx, args) => {
        await checkRateLimit(ctx, args.userId, args.operation);
    },
});

/**
 * Rate limit check that returns a boolean instead of throwing.
 * Useful when you want to handle rate limiting gracefully.
 * 
 * @param ctx - Convex mutation context
 * @param userId - The user to check
 * @param operation - The operation being performed
 * @returns Object with isAllowed boolean and optional error message
 */
export async function checkRateLimitSafe(
    ctx: MutationCtx,
    userId: Id<"users">,
    operation: string
): Promise<{ isAllowed: boolean; error?: string }> {
    try {
        await checkRateLimit(ctx, userId, operation);
        return { isAllowed: true };
    } catch (error) {
        return {
            isAllowed: false,
            error: error instanceof Error ? error.message : "Rate limit exceeded"
        };
    }
}

/**
 * Gets the current rate limit status for a user and operation.
 * Useful for displaying remaining requests to users.
 * 
 * @param ctx - Convex mutation context
 * @param userId - The user to check
 * @param operation - The operation to check
 * @returns Current usage and limits
 */
export async function getRateLimitStatus(
    ctx: MutationCtx,
    userId: Id<"users">,
    operation: string
): Promise<{
    used: number;
    limit: number;
    remaining: number;
    resetInMs: number;
}> {
    const config = RATE_LIMITS[operation] || RATE_LIMITS.default;
    const now = Date.now();
    const windowStart = now - config.windowMs;

    const rateLimitKey = `ratelimit:${userId}:${operation}`;

    const recentRequests = await ctx.db
        .query("uploads")
        .withIndex("by_key", (q) => q.eq("key", rateLimitKey))
        .filter((q) => q.gte(q.field("uploadedAt"), windowStart))
        .collect();

    const oldestRequest = recentRequests.length > 0
        ? Math.min(...recentRequests.map(r => r.uploadedAt))
        : now;

    return {
        used: recentRequests.length,
        limit: config.maxRequests,
        remaining: Math.max(0, config.maxRequests - recentRequests.length),
        resetInMs: oldestRequest + config.windowMs - now,
    };
}
