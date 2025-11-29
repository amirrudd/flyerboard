import { useDescope, useSession } from "@descope/react-sdk";
import { useCallback, useEffect } from "react";

export function useDescopeAuth() {
    const { isAuthenticated, isSessionLoading, sessionToken } = useSession();
    const { } = useDescope();

    // Debug logging
    useEffect(() => {
        console.log("Descope Auth State:", {
            isAuthenticated,
            isSessionLoading,
            hasToken: !!sessionToken,
            tokenPreview: sessionToken ? sessionToken.substring(0, 20) + "..." : null
        });
    }, [isAuthenticated, isSessionLoading, sessionToken]);

    const fetchAccessToken = useCallback(async ({ forceRefreshToken }: { forceRefreshToken?: boolean } = {}) => {
        console.log("Convex requesting access token, authenticated:", isAuthenticated);

        // Return null if not authenticated
        if (!isAuthenticated || !sessionToken) {
            console.log("No token available, returning null");
            return null;
        }

        console.log("Returning session token to Convex");
        // Return the session token for Convex to verify
        return sessionToken;
    }, [isAuthenticated, sessionToken]);

    return {
        isLoading: isSessionLoading,
        isAuthenticated,
        fetchAccessToken,
    };
}
