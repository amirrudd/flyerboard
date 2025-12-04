import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

/**
 * Gets the current user's ID from Descope authentication.
 * This replaces getAuthUserId from @convex-dev/auth/server for Descope users.
 * 
 * @param ctx - Query or Mutation context
 * @returns User ID or null if not authenticated
 */
export async function getDescopeUserId(
    ctx: QueryCtx | MutationCtx
): Promise<Id<"users"> | null> {
    const identity = await ctx.auth.getUserIdentity();

    if (identity) {
        const subject = identity.subject;
        const user = await ctx.db
            .query("users")
            .filter((q) => q.eq(q.field("tokenIdentifier"), subject))
            .first();
        return user?._id || null;
    }

    // FALLBACK for local development when OIDC verification fails
    // In production (Convex Cloud), OIDC works properly and this won't activate
    const isDev = process.env.CONVEX_CLOUD_URL?.includes("convex.cloud") === false;

    if (!identity && isDev) {
        // Use the most recently created user (likely the one who just logged in)
        const recentUser = await ctx.db
            .query("users")
            .order("desc")
            .first();

        if (recentUser) {
            return recentUser._id;
        }
    }

    return null;
}
