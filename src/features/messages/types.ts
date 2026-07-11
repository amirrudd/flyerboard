/**
 * Local types for the unified messaging feature.
 *
 * NOTE: these are deliberately structural (plain strings, optional fields)
 * rather than importing convex _generated types — the unified-inbox backend
 * queries may still be evolving, and convex branded Ids are assignable to
 * `string`, so real query results type-check against these shapes.
 */

/** Which side of a conversation the current user is on. */
export type InboxRole = "selling" | "buying";

/** Role rendered on a chip — sale and bundle threads get their own visual. */
export type ChipRole = InboxRole | "sale" | "bundle";

/** Inbox list filter. */
export type InboxFilter = "all" | "selling" | "buying";

export interface InboxUser {
  _id: string;
  /** `string | null` so raw query rows (deleted-user fallbacks) assign directly. */
  name?: string | null;
  averageRating?: number;
  ratingCount?: number;
}

export interface InboxAd {
  _id: string;
  title: string;
  price?: number;
  images: string[];
  isActive: boolean;
}

export interface InboxSale {
  _id: string;
  title: string;
  slug?: string | null;
}

export interface InboxBundle {
  _id: string;
  label: string;
  status?: string;
}

/**
 * A chat row as returned by `posts.getSellerChats` / `posts.getBuyerChats`.
 * `buyer` is populated on seller-side rows, `seller` on buyer-side rows.
 * `latestMessage` is optional — older query versions omit it.
 */
export interface InboxChat {
  _id: string;
  adId?: string | null;
  saleEventId?: string | null;
  bundleId?: string | null;
  buyerId: string;
  sellerId: string;
  lastMessageAt: number;
  unreadCount: number;
  latestMessage?: { content: string; timestamp: number } | null;
  ad?: InboxAd | null;
  sale?: InboxSale | null;
  bundle?: InboxBundle | null;
  buyer?: InboxUser | null;
  seller?: InboxUser | null;
  archivedByBuyer?: boolean;
  archivedBySeller?: boolean;
}

/** An inbox chat tagged with the current user's role in it. */
export interface InboxConversation extends InboxChat {
  role: InboxRole;
}

/** A single message rendered inside ConversationThread. */
export interface ThreadMessage {
  _id: string;
  content: string;
  timestamp: number;
  senderId: string;
  /** Client-only optimistic-send state: in flight, not yet confirmed. */
  pending?: boolean;
  /** Client-only optimistic-send state: rejected — bubble offers retry. */
  failed?: boolean;
  /** Re-sends a failed message (only meaningful with `failed`). */
  onRetry?: () => void;
}
