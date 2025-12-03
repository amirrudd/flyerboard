import { useDescope, useSession } from "@descope/react-sdk";
import { useCallback, useEffect } from "react";

export function useDescopeAuth() {
    const { isAuthenticated, isSessionLoading, sessionToken } = useSession();
    const { } = useDescope();

    // Debug logging (development only)
    useEffect(() => {
        if (import.meta.env.DEV) {
            console.log("Descope Auth State:", {
                isAuthenticated,
                isSessionLoading,
                hasToken: !!sessionToken,
                tokenPreview: sessionToken ? sessionToken.substring(0, 20) + "..." : null
            });
        }
    }, [isAuthenticated, isSessionLoading, sessionToken]);

    const fetchAccessToken = useCallback(async ({ forceRefreshToken }: { forceRefreshToken?: boolean } = {}) => {
        if (import.meta.env.DEV) {
            console.log("Convex requesting access token, authenticated:", isAuthenticated);
        }

        // Return null if not authenticated
        if (!isAuthenticated || !sessionToken) {
            if (import.meta.env.DEV) {
                console.log("No token available, returning null");
            }
            return null;
        }

        if (import.meta.env.DEV) {
            console.log("Returning session token to Convex");
        }
        // Return the session token for Convex to verify
        return sessionToken;
    }, [isAuthenticated, sessionToken]);

    return {
        isLoading: isSessionLoading,
        isAuthenticated,
        fetchAccessToken,
    };
}
