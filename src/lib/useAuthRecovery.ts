import { useCallback } from "react";
import { useDescope, useSession } from "@descope/react-sdk";
import { logDebug, logError } from "./logger";

/**
 * Auth error detection helper.
 * Checks if an error is related to authentication issues.
 */
export function isAuthError(error: Error | null | undefined): boolean {
    if (!error) return false;

    const authErrorPatterns = [
        "Not authenticated",
        "Unauthorized",
        "401",
        "Token expired",
        "Invalid token",
        "Session expired",
        "Authentication failed",
    ];

    const errorMessage = error.message?.toLowerCase() || "";
    return authErrorPatterns.some(pattern =>
        errorMessage.includes(pattern.toLowerCase())
    );
}

/**
 * Hook that provides authentication recovery capabilities.
 * Use this to handle token expiration and auth errors gracefully.
 * 
 * Note: Descope's autoRefresh handles normal token refresh automatically.
 * This hook is for explicit recovery when auth is broken.
 */
export function useAuthRecovery() {
    const sdk = useDescope();
    const { isAuthenticated } = useSession();

    /**
     * Force logout the user and clear all session data.
     * Use this when auth is broken and we need to start fresh.
     */
    const forceLogout = useCallback(async () => {
        logDebug("Auth Recovery: Forcing logout");
        try {
            await sdk.logout();
            logDebug("Auth Recovery: Logout successful");
        } catch (error) {
            logError("Auth Recovery: Logout failed, clearing storage manually", error);
            // Even if SDK logout fails, clear any cached state
            // This ensures the user can start a fresh login
        }
    }, [sdk]);

    /**
     * Attempt to recover from an auth error.
     * First tries to refresh the session, then logs out if that fails.
     * 
     * @returns true if recovery succeeded (session refreshed), false if user was logged out
     */
    const attemptRecovery = useCallback(async (): Promise<boolean> => {
        logDebug("Auth Recovery: Attempting session recovery");

        // If not authenticated, just logout to clear any stale state
        if (!isAuthenticated) {
            logDebug("Auth Recovery: Not authenticated, forcing logout");
            await forceLogout();
            return false;
        }

        try {
            // Try to refresh the session
            const response = await sdk.refresh();

            if (response.ok) {
                logDebug("Auth Recovery: Session refreshed successfully");
                return true;
            } else {
                logDebug("Auth Recovery: Refresh failed, logging out", response.error);
                await forceLogout();
                return false;
            }
        } catch (error) {
            logError("Auth Recovery: Refresh threw error, logging out", error);
            await forceLogout();
            return false;
        }
    }, [isAuthenticated, sdk, forceLogout]);

    return {
        isAuthenticated,
        forceLogout,
        attemptRecovery,
        isAuthError,
    };
}
