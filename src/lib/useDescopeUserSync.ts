import { useEffect, useState } from "react";
import { useSession, useUser } from "@descope/react-sdk";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { logDebug, logError } from "./logger";

/**
 * Hook that automatically syncs Descope user to Convex on authentication.
 * Call this in your App component or main layout.
 * Note: Phone numbers from OTP are NOT synced for privacy protection.
 * 
 * @returns {boolean} isUserSynced - Whether the user has been synced to Convex database
 */
export function useDescopeUserSync() {
    const { isAuthenticated, isSessionLoading } = useSession();
    const { user } = useUser();
    const syncDescopeUser = useMutation(api.descopeAuth.syncDescopeUser);
    const [isUserSynced, setIsUserSynced] = useState(false);

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

            // Await the sync to ensure user exists in database before marking as synced
            syncDescopeUser({
                name: user.name,
                email: user.email,
            })
                .then(() => {
                    logDebug("User successfully synced to Convex");
                    setIsUserSynced(true);
                })
                .catch((error) => {
                    logError("Failed to sync Descope user to Convex", error);
                    setIsUserSynced(false);
                });
        } else {
            // Reset sync status when user logs out
            setIsUserSynced(false);
        }
    }, [isAuthenticated, isSessionLoading, user, syncDescopeUser]);

    return isUserSynced;
}
