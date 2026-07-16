import { m } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { Clock } from "@phosphor-icons/react";
import { useMotionPrefs } from "../../hooks/useMotionPrefs";

export interface MessageBubbleProps {
  content: string;
  timestamp: number;
  isOwn: boolean;
  /** Optimistic send in flight: 60% opacity + clock glyph instead of time. */
  pending?: boolean;
  /** Send rejected: "Not sent — tap to retry"; the bubble becomes tappable. */
  failed?: boolean;
  /** Called when a failed bubble is tapped (Enter/Space too). */
  onRetry?: () => void;
}

/**
 * A single chat bubble. Own messages sit right in brand primary; the other
 * party's sit left on muted with a hairline ring — same visual language as
 * AdMessages/UserDashboard bubbles.
 *
 * Optimistic-send states (only ever on own messages): `pending` dims the
 * bubble and swaps the timestamp for a clock; `failed` turns the whole
 * bubble into a retry button so the typed content is never lost.
 */
export function MessageBubble({
  content,
  timestamp,
  isOwn,
  pending = false,
  failed = false,
  onRetry,
}: MessageBubbleProps) {
  const { bubbleIn } = useMotionPrefs();

  const retryable = failed && !!onRetry;
  const retryProps = retryable
    ? {
        role: "button" as const,
        tabIndex: 0,
        onClick: onRetry,
        onKeyDown: (event: React.KeyboardEvent) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onRetry?.();
          }
        },
        "aria-label": `Not sent — tap to retry: ${content}`,
      }
    : {};

  return (
    <div
      data-testid="message-bubble"
      className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
    >
      <m.div
        {...bubbleIn()}
        {...retryProps}
        className={`max-w-xs lg:max-w-md px-4 py-2.5 rounded-2xl shadow-sm ${
          isOwn
            ? "bg-primary text-primary-foreground rounded-tr-sm"
            : "bg-muted/60 ring-1 ring-border/60 text-foreground rounded-tl-sm"
        }${pending ? " opacity-60" : ""}${
          retryable
            ? " cursor-pointer ring-2 ring-destructive/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            : ""
        }`}
      >
        {/* [overflow-wrap:anywhere] so unbroken strings (long URLs) wrap instead
            of forcing horizontal scroll on narrow viewports. */}
        <p className="text-sm whitespace-pre-wrap leading-relaxed [overflow-wrap:anywhere]">{content}</p>
        {failed ? (
          <p
            className={`text-[11px] mt-1 font-semibold underline underline-offset-2 ${
              isOwn ? "text-primary-foreground" : "text-destructive"
            }`}
          >
            Not sent — tap to retry
          </p>
        ) : pending ? (
          <p
            className={`text-[11px] mt-1 inline-flex items-center gap-1 ${
              isOwn ? "text-primary-foreground/75" : "text-muted-foreground"
            }`}
          >
            <Clock className="w-3 h-3" aria-hidden="true" />
            Sending
          </p>
        ) : (
          <p
            className={`text-[11px] mt-1 tabular-nums ${
              isOwn ? "text-primary-foreground/75" : "text-muted-foreground"
            }`}
          >
            {formatDistanceToNow(new Date(timestamp), { addSuffix: true })}
          </p>
        )}
      </m.div>
    </div>
  );
}
