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

    // FALLBACK for local development if OIDC fails
    // This allows you to test features even if auth isn't perfectly configured locally
    const isDev = process.env.CONVEX_CLOUD_URL?.includes("convex.cloud") === false; // Rough check for local/dev

    if (!identity && isDev) { // Only apply fallback if no identity AND in development
        console.warn("getDescopeUserId: No identity found. Using fallback user for development.");
        const firstUser = await ctx.db.query("users").first();
        if (firstUser) {
            console.log(`Using fallback user: ${firstUser.email} (${firstUser._id})`);
            return firstUser._id;
        }
        return null;
    }

    return null;
}
