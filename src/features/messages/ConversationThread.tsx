import { Fragment, useEffect, useMemo, useRef } from "react";
import { MessageBubble } from "./MessageBubble";
import { getDaySeparatorLabel, isSameLocalDay } from "./daySeparators";
import type { ThreadMessage } from "./types";

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
 * See src/features/ads/ADMESSAGES_BEHAVIOR.md before changing any of this.
 */
export function ConversationThread({
  messages,
  currentUserId,
  className = "",
}: ConversationThreadProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Defensive chronological sort — backends already return ascending order,
  // but the ordering is a protected behavior so we never trust the caller.
  const ordered = useMemo(
    () => [...messages].sort((a, b) => a.timestamp - b.timestamp),
    [messages]
  );

  // Single `now` per render so all separator labels agree.
  const now = new Date();

  // Auto-scroll to bottom when the thread opens or new messages arrive.
  useEffect(() => {
    if (ordered.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [ordered]);

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
              />
            </Fragment>
          );
        })}
        <div ref={messagesEndRef} data-testid="messages-end" />
      </div>
    </div>
  );
}
