import { useDescope, useSession } from "@descope/react-sdk";
import { useCallback } from "react";

export function useDescopeAuth() {
    const { isAuthenticated, isSessionLoading, sessionToken } = useSession();
    const { } = useDescope(); // We might need useDescope for other things later, but not for auth state directly

    const fetchAccessToken = useCallback(async ({ forceRefreshToken }: { forceRefreshToken?: boolean } = {}) => {
        // Descope SDK handles refreshing automatically, but we can return the current token.
        // If forceRefreshToken is true, we might need to trigger a refresh explicitly,
        // but usually returning the token is enough as the SDK keeps it fresh.
        return sessionToken;
    }, [sessionToken]);

    return {
        isLoading: isSessionLoading,
        isAuthenticated,
        fetchAccessToken,
    };
}
