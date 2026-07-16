import { m } from "framer-motion";
import { useMotionPrefs } from "../../hooks/useMotionPrefs";

export interface UnreadBadgeProps {
  count: number;
  className?: string;
}

/**
 * Primary unread-count pill. Hidden at 0, capped at "99+", scale-pops
 * (0.8 → 1, ~200ms) on mount and whenever the count changes (via re-key).
 */
export function UnreadBadge({ count, className = "" }: UnreadBadgeProps) {
  const { scalePop } = useMotionPrefs();

  if (count <= 0) return null;

  const display = count > 99 ? "99+" : String(count);

  return (
    <m.span
      key={display}
      {...scalePop()}
      aria-label={`${count} unread ${count === 1 ? "message" : "messages"}`}
      className={`inline-flex items-center justify-center min-w-[20px] h-5 px-2 rounded-full text-[11px] font-semibold tabular-nums bg-primary text-primary-foreground ${className}`}
    >
      {display}
    </m.span>
  );
}
