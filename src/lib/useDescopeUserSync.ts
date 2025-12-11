import { useEffect } from "react";
import { useSession, useUser } from "@descope/react-sdk";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { logDebug, logError } from "./logger";

/**
 * Hook that automatically syncs Descope user to Convex on authentication.
 * Call this in your App component or main layout.
 * Note: Phone numbers from OTP are NOT synced for privacy protection.
 */
export function useDescopeUserSync() {
    const { isAuthenticated, isSessionLoading } = useSession();
    const { user } = useUser();
    const syncDescopeUser = useMutation(api.descopeAuth.syncDescopeUser);

    useEffect(() => {
        if (isAuthenticated && !isSessionLoading && user) {
            // Sync user data from Descope to Convex
            // Backend is smart: won't overwrite existing name with empty string
            logDebug('Syncing Descope user to Convex:', {
                subject: user.loginIds?.[0] || user.userId,
                name: user.name,
                hasEmail: !!user.email,
                hasPhone: !!user.phone,
            });

            try {
                syncDescopeUser({
                    name: user.name,
                    email: user.email,
                });
            } catch (error) {
                logError("Failed to sync Descope user to Convex", error);
            }
        }
    }, [isAuthenticated, isSessionLoading, user, syncDescopeUser]);
}
