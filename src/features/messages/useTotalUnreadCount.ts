import { useQuery } from "convex/react";
import { useSession } from "@descope/react-sdk";
import { api } from "../../../convex/_generated/api";
import { useUserSync } from "../../context/UserSyncContext";

/**
 * Total unread messages across every conversation (both roles), for nav
 * badges. Owns the auth/user-sync gate so badge sites don't re-copy it
 * (skipping the gate causes "Not authenticated" races — see
 * ADMESSAGES_BEHAVIOR.md). Returns 0 while signed out or loading.
 */
export function useTotalUnreadCount(): number {
  const { isAuthenticated, isSessionLoading } = useSession();
  const { isUserSynced } = useUserSync();
  const ready = isAuthenticated && !isSessionLoading && isUserSynced;

  const count = useQuery(
    api.messages.getTotalUnreadCount,
    ready ? {} : "skip"
  );

  return count ?? 0;
}
