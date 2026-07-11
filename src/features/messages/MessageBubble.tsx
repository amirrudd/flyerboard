import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { useMotionPrefs } from "../../hooks/useMotionPrefs";

export interface MessageBubbleProps {
  content: string;
  timestamp: number;
  isOwn: boolean;
}

/**
 * A single chat bubble. Own messages sit right in brand primary; the other
 * party's sit left on muted with a hairline ring — same visual language as
 * AdMessages/UserDashboard bubbles.
 */
export function MessageBubble({ content, timestamp, isOwn }: MessageBubbleProps) {
  const { bubbleIn } = useMotionPrefs();

  return (
    <div
      data-testid="message-bubble"
      className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
    >
      <motion.div
        {...bubbleIn()}
        className={`max-w-xs lg:max-w-md px-4 py-2.5 rounded-2xl shadow-sm ${
          isOwn
            ? "bg-primary text-primary-foreground rounded-tr-sm"
            : "bg-muted/60 ring-1 ring-border/60 text-foreground rounded-tl-sm"
        }`}
      >
        {/* [overflow-wrap:anywhere] so unbroken strings (long URLs) wrap instead
            of forcing horizontal scroll on narrow viewports. */}
        <p className="text-sm whitespace-pre-wrap leading-relaxed [overflow-wrap:anywhere]">{content}</p>
        <p
          className={`text-[11px] mt-1 tabular-nums ${
            isOwn ? "text-primary-foreground/75" : "text-muted-foreground"
          }`}
        >
          {formatDistanceToNow(new Date(timestamp), { addSuffix: true })}
        </p>
      </motion.div>
    </div>
  );
}
