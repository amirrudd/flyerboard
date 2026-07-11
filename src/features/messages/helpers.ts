import type { ChipRole, InboxChat, InboxRole, InboxUser } from "./types";

/**
 * Shared derivations for rendering a conversation. Both the inbox row and
 * any thread header must present the same counterpart/title for the same
 * chat — deriving in one place keeps them from drifting.
 */

export function isSaleThread(chat: InboxChat): boolean {
  return Boolean(chat.saleEventId);
}

export function isBundleThread(chat: InboxChat): boolean {
  return Boolean(chat.bundleId);
}

export function getChipRole(chat: InboxChat, role: InboxRole): ChipRole {
  if (isSaleThread(chat)) return "sale";
  if (isBundleThread(chat)) return "bundle";
  return role;
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

/** Display title for the item/sale/bundle a conversation is about. */
export function getItemTitle(chat: InboxChat): string {
  return (
    chat.ad?.title ??
    chat.sale?.title ??
    chat.bundle?.label ??
    (isSaleThread(chat) ? "Moving Sale" : isBundleThread(chat) ? "Bundle" : "Deleted Flyer")
  );
}

/** Facts the thread header/composer needs, per thread kind. Pure — returns an
 * href rather than a navigate closure so every surface (page, dashboard,
 * future two-pane) derives identical behavior from one place.
 *
 * Flyer threads: a sold/inactive flyer keeps the composer ENABLED (arranging
 * pickup on a sold item is a real flow) and shows a "No longer available"
 * pill with a non-tappable context strip; only a fully deleted flyer
 * disables sending. */
export interface ThreadMeta {
  viewItemLabel: string;
  viewItemHref?: string;
  composerDisabled: boolean;
  composerDisabledReason: string;
  statusLabel?: string;
}

export function getThreadMeta(chat: InboxChat): ThreadMeta {
  if (isSaleThread(chat) || isBundleThread(chat)) {
    const sale = isSaleThread(chat);
    const item = sale ? chat.sale : chat.bundle;
    const noun = sale ? "sale" : "bundle";
    return {
      viewItemLabel: `View ${noun}`,
      viewItemHref: sale
        ? chat.sale?.slug
          ? `/sale/${chat.sale.slug}`
          : undefined
        : chat.bundle
          ? `/bundle/${chat.bundle._id}`
          : undefined,
      composerDisabled: !item,
      composerDisabledReason: `This ${noun} is no longer available`,
      statusLabel: item ? undefined : "No longer available",
    };
  }
  const adAvailable = Boolean(chat.ad && chat.ad.isActive !== false);
  return {
    viewItemLabel: "View flyer",
    viewItemHref: adAvailable && chat.adId ? `/ad/${chat.adId}` : undefined,
    composerDisabled: !chat.ad,
    composerDisabledReason: "This flyer is no longer active",
    statusLabel: adAvailable ? undefined : "No longer available",
  };
}
