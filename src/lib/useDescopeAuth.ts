import { useDescope, useSession } from "@descope/react-sdk";
import { useCallback, useEffect } from "react";
import { logDebug } from "./logger";

export function useDescopeAuth() {
    const { isAuthenticated, isSessionLoading, sessionToken } = useSession();
    const { } = useDescope();

    // Debug logging (development only)
    useEffect(() => {
        if (isAuthenticated !== undefined) {
            logDebug("Descope Auth State:", {
                isAuthenticated,
                isSessionLoading,
                sessionToken: sessionToken ? "present" : "missing",
            });
        }
    }, [isAuthenticated, isSessionLoading, sessionToken]);

    const fetchAccessToken = useCallback(async ({ forceRefreshToken }: { forceRefreshToken?: boolean } = {}) => {
        logDebug("Convex requesting access token, authenticated:", isAuthenticated);

        // Return null if not authenticated
        if (!isAuthenticated) {
            return null;
        }

        if (!sessionToken) {
            logDebug("No token available, returning null");
            return null;
        }

        // Return the Descope session token as the access token
        // Convex will verify this via OIDC
        logDebug("Returning session token to Convex");
        return sessionToken;
    }, [isAuthenticated, sessionToken]);

    return {
        isLoading: isSessionLoading,
        isAuthenticated,
        fetchAccessToken,
    };
}
