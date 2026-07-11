import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown } from "@phosphor-icons/react";
import { MessageBubble } from "./MessageBubble";
import { getDaySeparatorLabel, isSameLocalDay } from "./daySeparators";
import type { ThreadMessage } from "./types";

/** "Near bottom" of the scroll container — within this many px of the end. */
const NEAR_BOTTOM_PX = 120;

export interface ConversationThreadProps {
  messages: ThreadMessage[];
  currentUserId: string;
  /** Extra classes for the OUTER scroll container (padding overrides etc.). */
  className?: string;
}

/**
 * Scrollable message list implementing the protected chat scroll pattern:
 *
 * - OUTER container scrolls (`flex-1 min-h-0 overflow-y-auto`) — never put
 *   `justify-end` here, it breaks scrolling.
 * - INNER wrapper bottom-aligns short conversations
 *   (`flex flex-col min-h-full justify-end`) — never `flex-col-reverse`.
 * - `touchAction: pan-y` + `overscrollBehavior: contain` keep mobile touch
 *   scrolling working inside the globally scroll-locked body.
 * - Messages render chronologically (oldest → newest) with a
 *   `messagesEndRef` sentinel that auto-scrolls into view on open/new message.
 *
 * Scroll courtesy: when the reader has scrolled up (> ~120px from the
 * bottom) and a NEW message arrives from the other party, the thread does
 * NOT yank them down — a floating "New message" pill (sticky, zero-height in
 * flow so it never disturbs the protected layout) offers the jump instead.
 * Own sends and near-bottom arrivals keep the auto-scroll. A polite live
 * region announces incoming messages for screen readers either way.
 *
 * See src/features/ads/ADMESSAGES_BEHAVIOR.md before changing any of this.
 */
export function ConversationThread({
  messages,
  currentUserId,
  className = "",
}: ConversationThreadProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // Read inside the new-message effect, written by the scroll handler.
  // Starts true so the initial load pins to the bottom.
  const nearBottomRef = useRef(true);
  const prevRef = useRef<{ lastId: string | null } | null>(null);
  const [showNewMessagePill, setShowNewMessagePill] = useState(false);
  // Session count of incoming messages — rendering it into the polite live
  // region is what changes the text and triggers the announcement.
  const [incomingCount, setIncomingCount] = useState(0);

  // Defensive chronological sort — backends already return ascending order,
  // but the ordering is a protected behavior so we never trust the caller.
  const ordered = useMemo(
    () => [...messages].sort((a, b) => a.timestamp - b.timestamp),
    [messages]
  );

  // Single `now` per render so all separator labels agree.
  const now = new Date();

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const nearBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    nearBottomRef.current = nearBottom;
    if (nearBottom) setShowNewMessagePill(false);
  };

  const scrollToBottom = () => {
    setShowNewMessagePill(false);
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Auto-scroll to bottom when the thread opens or new messages arrive —
  // unless the reader has scrolled up and the new message is incoming
  // (scroll courtesy: show the pill instead of yanking them down).
  //
  // Keyed on the NEWEST message id, not the array: parents rebuild the
  // messages array on unrelated re-renders, and re-running the fall-through
  // scrollIntoView would yank a scrolled-up reader (defeating the pill).
  // (`lastSenderId` is a stable string for a given id, so the effect still
  // only fires when the newest message actually changes.)
  const lastId = ordered.length > 0 ? ordered[ordered.length - 1]._id : null;
  const lastSenderId =
    ordered.length > 0 ? ordered[ordered.length - 1].senderId : null;
  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = { lastId };
    if (lastId === null) return;

    // prev.lastId === null covers the empty-thread → first-message case,
    // which pins to the bottom like the initial load.
    const isNewMessage =
      prev !== null && prev.lastId !== null && lastId !== prev.lastId;
    if (isNewMessage && lastSenderId !== currentUserId) {
      setIncomingCount((count) => count + 1);
      if (!nearBottomRef.current) {
        setShowNewMessagePill(true);
        return;
      }
    }
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lastId, lastSenderId, currentUserId]);

  // iOS keyboard settle: the visual-viewport resize lands ~300ms after a
  // composer textarea gains focus — re-pin the thread to its bottom so the
  // newest message isn't hidden behind the keyboard. Lives here (not in the
  // page) so every thread surface gets it (MessagesPage, AdMessages, sheets).
  // The composer is a sibling, so listen at document level and filter.
  useEffect(() => {
    let timer: number | undefined;
    const onFocusIn = (event: FocusEvent) => {
      if (!(event.target instanceof HTMLTextAreaElement)) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 300);
    };
    document.addEventListener("focusin", onFocusIn);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      data-testid="conversation-thread"
      className={`flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 ${className}`}
      style={{ touchAction: "pan-y", overscrollBehavior: "contain" }}
    >
      <div className="flex flex-col space-y-4 min-h-full justify-end">
        {ordered.map((message, index) => {
          const previous = ordered[index - 1];
          const separatorLabel =
            !previous || !isSameLocalDay(previous.timestamp, message.timestamp)
              ? getDaySeparatorLabel(message.timestamp, now)
              : null;
          return (
            <Fragment key={message._id}>
              {separatorLabel && (
                <div
                  data-testid="day-separator"
                  role="separator"
                  aria-label={separatorLabel}
                  className="flex justify-center"
                >
                  <span className="px-3 py-1 rounded-full bg-muted/60 ring-1 ring-border/60 text-[11px] font-medium text-muted-foreground tabular-nums">
                    {separatorLabel}
                  </span>
                </div>
              )}
              <MessageBubble
                content={message.content}
                timestamp={message.timestamp}
                isOwn={message.senderId === currentUserId}
                pending={message.pending}
                failed={message.failed}
                onRetry={message.onRetry}
              />
            </Fragment>
          );
        })}
        <div ref={messagesEndRef} data-testid="messages-end" />
      </div>

      {/* Floating "New message" pill: sticky + zero-height so it adds no
          layout to the protected scroll content; the button overflows the
          h-0 line downward, hovering above the scrollport's bottom edge. */}
      {showNewMessagePill && (
        <div className="sticky bottom-16 h-0 flex justify-center pointer-events-none">
          <button
            type="button"
            onClick={scrollToBottom}
            className="pointer-events-auto inline-flex items-center gap-1.5 min-h-11 px-4 rounded-full bg-primary text-primary-foreground text-sm font-semibold shadow-card-hover active:scale-[0.98] transition-all"
          >
            <ArrowDown className="w-4 h-4" aria-hidden="true" />
            New message
          </button>
        </div>
      )}

      {/* Polite announcement of incoming messages for screen readers —
          content-free by design (the bubble itself carries the content). */}
      <div aria-live="polite" className="sr-only">
        {incomingCount > 0 &&
          `${incomingCount} new ${incomingCount === 1 ? "message" : "messages"} received`}
      </div>
    </div>
  );
}
