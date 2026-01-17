import { MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";

/**
 * Rate limiting configuration for different operations.
 * Uses a sliding window approach stored in memory.
 * 
 * Note: This is an in-process rate limiter. For production scale,
 * consider using Convex's built-in rate limiting or external service.
 */

interface RateLimitConfig {
    /** Maximum number of requests allowed in the window */
    maxRequests: number;
    /** Time window in milliseconds */
    windowMs: number;
}

/** Default rate limits per operation type */
export const RATE_LIMITS: Record<string, RateLimitConfig> = {
    // Flyer operations
    createAd: { maxRequests: 10, windowMs: 60 * 60 * 1000 }, // 10 per hour
    updateAd: { maxRequests: 30, windowMs: 60 * 60 * 1000 }, // 30 per hour
    deleteAd: { maxRequests: 20, windowMs: 60 * 60 * 1000 }, // 20 per hour

    // Messaging
    sendMessage: { maxRequests: 60, windowMs: 60 * 1000 }, // 60 per minute
    createChat: { maxRequests: 20, windowMs: 60 * 60 * 1000 }, // 20 per hour

    // Reports
    createReport: { maxRequests: 5, windowMs: 60 * 60 * 1000 }, // 5 per hour

    // Ratings
    submitRating: { maxRequests: 10, windowMs: 60 * 60 * 1000 }, // 10 per hour

    // Image uploads
    generateUploadUrl: { maxRequests: 50, windowMs: 60 * 60 * 1000 }, // 50 per hour

    // Default for unspecified operations
    default: { maxRequests: 100, windowMs: 60 * 1000 }, // 100 per minute
};

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
    const now = Date.now();
    const windowStart = now - config.windowMs;

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

    if (recentRequests.length >= config.maxRequests) {
        const resetTime = Math.ceil((windowStart + config.windowMs - now) / 1000 / 60);
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
        .filter((q) => q.lt(q.field("uploadedAt"), windowStart - config.windowMs))
        .collect();

    for (const record of oldRecords) {
        await ctx.db.delete(record._id);
    }
}

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
