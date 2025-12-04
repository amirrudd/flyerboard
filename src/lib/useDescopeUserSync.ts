import { useEffect } from "react";
import { useSession, useUser } from "@descope/react-sdk";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

/**
 * Hook that automatically syncs Descope user to Convex on authentication.
 * Call this in your App component or main layout.
 * Note: Phone numbers from OTP are NOT synced for privacy protection.
 */
export function useDescopeUserSync() {
    const { isAuthenticated, isSessionLoading } = useSession();
    const { user } = useUser();
    const syncUser = useMutation(api.descopeAuth.syncDescopeUser);

    useEffect(() => {
        if (isAuthenticated && !isSessionLoading && user) {
            console.log('Syncing Descope user to Convex:', {
                email: user.email,
                name: user.name,
                // Phone is NOT synced for privacy
            });

            // Sync user to Convex (without phone for privacy)
            syncUser({
                email: user.email || undefined,
                name: user.name || undefined,
            }).catch((error) => {
                console.error("Failed to sync Descope user to Convex:", error);
            });
        }
    }, [isAuthenticated, isSessionLoading, user, syncUser]);
}
