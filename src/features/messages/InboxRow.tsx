import { m } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { House, Image as ImageIcon, Package } from "@phosphor-icons/react";
import { ImageDisplay } from "../../components/ui/ImageDisplay";
import { RoleChip } from "./RoleChip";
import { UnreadBadge } from "./UnreadBadge";
import { useMotionPrefs } from "../../hooks/useMotionPrefs";
import type { ChipRole, InboxChat, InboxRole } from "./types";
import { getChipRole, getCounterpartName, getItemTitle, isBundleThread, isSaleThread } from "./helpers";

export interface InboxRowProps {
  chat: InboxChat;
  role: InboxRole;
  onOpen: (chatId: string) => void;
  onArchive?: (chatId: string) => void;
  /** Highlights the row + sets aria-current (desktop master-detail). */
  isActive?: boolean;
  /** Position in the list — drives the 40ms entrance stagger. */
  index?: number;
  /** Extra classes on the row root (e.g. a list-context min-height). */
  className?: string;
  /** Copy for the row action button — "Archive" (default) or "Unarchive". */
  archiveLabel?: string;
}

/**
 * One conversation row in the unified inbox: thumbnail (ad image / house for
 * sale threads), counterpart name, role chip, latest-message snippet,
 * relative time, unread badge, optional Archive.
 *
 * The row itself acts as a button (role="button" + keyboard handling rather
 * than <button>, so the nested Archive button stays valid HTML).
 */
export function InboxRow({
  chat,
  role,
  onOpen,
  onArchive,
  isActive = false,
  index = 0,
  className,
  archiveLabel = "Archive",
}: InboxRowProps) {
  const { listStagger } = useMotionPrefs();

  const isSale = isSaleThread(chat);
  const isBundle = isBundleThread(chat);
  const chipRole: ChipRole = getChipRole(chat, role);
  const counterpartName = getCounterpartName(chat, role);
  const itemTitle = getItemTitle(chat);

  const open = () => onOpen(chat._id);

  return (
    <m.div
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      }}
      aria-current={isActive ? "true" : undefined}
      aria-label={`Conversation with ${counterpartName}`}
      // Focus-restoration hook: lets the inbox re-focus the originating row
      // when the user comes back from a full-screen thread (a11y).
      data-chat-id={chat._id}
      {...listStagger(index)}
      className={`relative w-full text-left px-4 py-3.5 sm:px-5 sm:py-4 cursor-pointer transition-colors active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset ${
        isActive ? "bg-muted/50" : "hover:bg-muted/40"
      }${className ? ` ${className}` : ""}`}
    >
      {isActive && (
        <span
          aria-hidden="true"
          className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full bg-primary"
        />
      )}

      <div className="flex items-start gap-3">
        {/* Thumbnail */}
        {isSale ? (
          <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center ring-1 ring-border/60 shrink-0">
            <House className="w-5 h-5" weight="fill" aria-hidden="true" />
          </div>
        ) : isBundle ? (
          <div className="w-12 h-12 rounded-xl bg-bundle/10 text-bundle-emphasis flex items-center justify-center ring-1 ring-border/60 shrink-0">
            <Package className="w-5 h-5" weight="fill" aria-hidden="true" />
          </div>
        ) : chat.ad?.images?.[0] ? (
          <ImageDisplay
            imageRef={chat.ad.images[0]}
            alt={chat.ad.title}
            className="w-12 h-12 object-cover rounded-xl ring-1 ring-border/60 shrink-0"
            size="thumb"
          />
        ) : (
          <div className="w-12 h-12 bg-muted rounded-xl flex items-center justify-center ring-1 ring-border/60 shrink-0">
            <ImageIcon className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <span className="font-medium text-foreground truncate">
              {counterpartName}
            </span>
            <UnreadBadge count={chat.unreadCount} className="ml-2" />
          </div>

          <div className="flex items-center gap-2 mb-1 min-w-0">
            <RoleChip role={chipRole} />
            <span className="text-xs text-muted-foreground truncate">
              {itemTitle}
            </span>
          </div>

          {chat.latestMessage && (
            <p className="text-sm truncate text-muted-foreground">
              {chat.latestMessage.content}
            </p>
          )}

          <div className="flex items-center justify-between gap-2 mt-1">
            <p className="text-xs text-muted-foreground/80 tabular-nums">
              {formatDistanceToNow(new Date(chat.lastMessageAt), {
                addSuffix: true,
              })}
            </p>
            {onArchive && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onArchive(chat._id);
                }}
                className="inline-flex items-center h-8 px-3 rounded-full bg-muted/40 ring-1 ring-border text-muted-foreground text-sm font-medium hover:bg-muted/70 hover:text-foreground hover:ring-foreground/15 active:scale-[0.98] transition-all"
              >
                {archiveLabel}
              </button>
            )}
          </div>
        </div>
      </div>
    </m.div>
  );
}
