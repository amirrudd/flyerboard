import { useEffect, useState } from "react";
import { useSession, useUser } from "@descope/react-sdk";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { logDebug, logError } from "./logger";
import { isAuthError } from "./useAuthRecovery";

interface UserSyncState {
    /** Whether the user has been successfully synced to Convex database */
    isSynced: boolean;
    /** Whether sync failed (could indicate auth issues) */
    syncFailed: boolean;
    /** Whether sync is currently in progress */
    isSyncing: boolean;
}

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
    const [syncState, setSyncState] = useState<UserSyncState>({
        isSynced: false,
        syncFailed: false,
        isSyncing: false,
    });

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

            setSyncState(prev => ({ ...prev, isSyncing: true }));

            // Await the sync to ensure user exists in database before marking as synced
            syncDescopeUser({
                name: user.name,
                email: user.email,
            })
                .then(() => {
                    logDebug("User successfully synced to Convex");
                    setSyncState({ isSynced: true, syncFailed: false, isSyncing: false });
                })
                .catch((error) => {
                    logError("Failed to sync Descope user to Convex", error);

                    // Check if this is an auth error - if so, the ErrorBoundary
                    // will handle showing the recovery UI
                    if (isAuthError(error)) {
                        logError("Sync failed due to authentication issue - user should re-authenticate");
                    }

                    setSyncState({ isSynced: false, syncFailed: true, isSyncing: false });
                });
        } else {
            // Reset sync status when user logs out
            setSyncState({ isSynced: false, syncFailed: false, isSyncing: false });
        }
    }, [isAuthenticated, isSessionLoading, user, syncDescopeUser]);

    // Return boolean for backward compatibility
    return syncState.isSynced;
}

