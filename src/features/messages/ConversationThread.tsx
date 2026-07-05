import { useEffect, useMemo, useRef } from "react";
import { MessageBubble } from "./MessageBubble";
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

  // Auto-scroll to bottom when the thread opens or new messages arrive.
  useEffect(() => {
    if (ordered.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [ordered]);

  return (
    <div
      data-testid="conversation-thread"
      className={`flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 ${className}`}
      style={{ touchAction: "pan-y", overscrollBehavior: "contain" }}
    >
      <div className="flex flex-col space-y-4 min-h-full justify-end">
        {ordered.map((message) => (
          <MessageBubble
            key={message._id}
            content={message.content}
            timestamp={message.timestamp}
            isOwn={message.senderId === currentUserId}
          />
        ))}
        <div ref={messagesEndRef} data-testid="messages-end" />
      </div>
    </div>
  );
}
