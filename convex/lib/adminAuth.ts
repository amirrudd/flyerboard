import { QueryCtx, MutationCtx } from "../_generated/server";
import { getDescopeUserId } from "./auth";

/**
 * Verifies that the current user is an admin.
 * Throws an error if not authenticated or not an admin.
 * @returns The admin user's ID
 */
export async function requireAdmin(ctx: QueryCtx | MutationCtx) {
    const userId = await getDescopeUserId(ctx);
    if (!userId) {
        throw new Error("Must be logged in");
    }

    const user = await ctx.db.get(userId);
    if (!user?.isAdmin) {
        throw new Error("Admin access required");
    }

    return userId;
}

/**
 * Checks if the current user is an admin without throwing an error.
 * @returns true if user is admin, false otherwise
 */
export async function isAdmin(ctx: QueryCtx | MutationCtx): Promise<boolean> {
    try {
        const userId = await getDescopeUserId(ctx);
        if (!userId) return false;

        const user = await ctx.db.get(userId);
        return user?.isAdmin === true;
    } catch {
        return false;
    }
}
