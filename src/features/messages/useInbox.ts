import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { useSession } from "@descope/react-sdk";
import { api } from "../../../convex/_generated/api";
import { useUserSync } from "../../context/UserSyncContext";
import type { InboxChat, InboxConversation, InboxFilter } from "./types";

/**
 * Merge seller-side and buyer-side chat lists into one inbox, tagging each
 * row with the current user's role and sorting by lastMessageAt desc.
 * Defensive client-side sort — the backend sorts too, but the merge of two
 * pre-sorted lists still needs it.
 */
export function mergeInboxChats(
  sellerChats: readonly InboxChat[] | undefined,
  buyerChats: readonly InboxChat[] | undefined
): InboxConversation[] {
  const selling: InboxConversation[] = (sellerChats ?? []).map((chat) => ({
    ...chat,
    role: "selling" as const,
  }));
  const buying: InboxConversation[] = (buyerChats ?? []).map((chat) => ({
    ...chat,
    role: "buying" as const,
  }));
  return [...selling, ...buying].sort(
    (a, b) => b.lastMessageAt - a.lastMessageAt
  );
}

/**
 * Apply the role filter ('all' | 'selling' | 'buying') and the optional
 * flyer filter (only conversations about that ad).
 */
export function filterInboxConversations(
  conversations: readonly InboxConversation[],
  filter: InboxFilter,
  flyerId?: string
): InboxConversation[] {
  return conversations.filter((conversation) => {
    if (filter !== "all" && conversation.role !== filter) return false;
    if (flyerId && conversation.adId !== flyerId) return false;
    return true;
  });
}

export interface UseInboxOptions {
  /** Only show conversations about this ad (deep-link `?flyer=<adId>`). */
  flyerId?: string;
  initialFilter?: InboxFilter;
  /**
   * Skip both chat queries entirely while false (e.g. the inbox tab isn't
   * visible). Defaults to true.
   */
  enabled?: boolean;
}

export interface UseInboxResult {
  /** Filtered, role-tagged conversations sorted by lastMessageAt desc. */
  conversations: InboxConversation[];
  filter: InboxFilter;
  setFilter: (filter: InboxFilter) => void;
  isLoading: boolean;
}

/**
 * Unified inbox: merges `posts.getSellerChats` + `posts.getBuyerChats`.
 * Both queries are auth-gated on authenticated + session loaded + user
 * synced — skipping this gate causes "Not authenticated" race errors
 * (see ADMESSAGES_BEHAVIOR.md).
 */
export function useInbox(options: UseInboxOptions = {}): UseInboxResult {
  const { flyerId, initialFilter = "all", enabled = true } = options;
  const [filter, setFilter] = useState<InboxFilter>(initialFilter);

  const { isAuthenticated, isSessionLoading } = useSession();
  const { isUserSynced } = useUserSync();
  const ready =
    enabled && isAuthenticated && !isSessionLoading && isUserSynced;

  const sellerChats = useQuery(
    api.posts.getSellerChats,
    ready ? {} : "skip"
  );
  const buyerChats = useQuery(
    api.posts.getBuyerChats,
    ready ? {} : "skip"
  );

  const merged = useMemo(
    () => mergeInboxChats(sellerChats, buyerChats),
    [sellerChats, buyerChats]
  );

  const conversations = useMemo(
    () => filterInboxConversations(merged, filter, flyerId),
    [merged, filter, flyerId]
  );

  // Loading covers the whole pre-data window: session resolving, the
  // authenticated-but-not-yet-synced gap (queries are skipped then, but the
  // inbox must NOT read as empty), and the queries themselves resolving.
  const isLoading =
    enabled &&
    (isSessionLoading ||
      (isAuthenticated && !isUserSynced) ||
      (ready && (sellerChats === undefined || buyerChats === undefined)));

  return { conversations, filter, setFilter, isLoading };
}
