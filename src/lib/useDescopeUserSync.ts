import { useEffect } from "react";
import { useSession, useUser } from "@descope/react-sdk";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

/**
 * Hook that automatically syncs Descope user to Convex on authentication.
 * Call this in your App component or main layout.
 */
export function useDescopeUserSync() {
    const { isAuthenticated, isSessionLoading } = useSession();
    const { user } = useUser();
    const syncUser = useMutation(api.descopeAuth.syncDescopeUser);

    useEffect(() => {
        if (isAuthenticated && !isSessionLoading && user) {
            // Sync user to Convex
            syncUser({
                email: user.email || undefined,
                name: user.name || undefined,
                phone: user.phone || undefined,
            }).catch((error) => {
                console.error("Failed to sync Descope user to Convex:", error);
            });
        }
    }, [isAuthenticated, isSessionLoading, user, syncUser]);
}
