import type { ChipRole, InboxChat, InboxRole, InboxUser } from "./types";

/**
 * Shared derivations for rendering a conversation. Both the inbox row and
 * any thread header must present the same counterpart/title for the same
 * chat — deriving in one place keeps them from drifting.
 */

export function isSaleThread(chat: InboxChat): boolean {
  return Boolean(chat.saleEventId);
}

export function getChipRole(chat: InboxChat, role: InboxRole): ChipRole {
  return isSaleThread(chat) ? "sale" : role;
}

/** The other party in the conversation, from the current user's role. */
export function getCounterpart(
  chat: InboxChat,
  role: InboxRole
): InboxUser | null | undefined {
  return role === "selling" ? chat.buyer : chat.seller;
}

export function getCounterpartName(chat: InboxChat, role: InboxRole): string {
  return getCounterpart(chat, role)?.name || "Deleted User";
}

/** Display title for the item/sale a conversation is about. */
export function getItemTitle(chat: InboxChat): string {
  return (
    chat.ad?.title ??
    chat.sale?.title ??
    (isSaleThread(chat) ? "Moving Sale" : "Deleted Flyer")
  );
}
