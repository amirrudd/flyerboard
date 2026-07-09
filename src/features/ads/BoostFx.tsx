import { AnimatePresence, motion, type TargetAndTransition } from "framer-motion";
import { ArrowUp } from "@phosphor-icons/react";

interface RingProps {
  initial: TargetAndTransition;
  animate: TargetAndTransition;
  transition: TargetAndTransition["transition"];
}

/**
 * Boost success ring pulse — an opacity-animated overlay (never an animated
 * border/box-shadow) that lives as an `absolute inset-0` sibling inside the
 * `relative rounded-2xl` card. Remounts on each boost via its `key={ringKey}`
 * (0 = never boosted → renders nothing).
 */
export function BoostRingOverlay({ ringKey, ringProps }: { ringKey: number; ringProps: RingProps }) {
  if (ringKey === 0) return null;
  return (
    <motion.div
      key={ringKey}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-primary"
      initial={ringProps.initial}
      animate={ringProps.animate}
      transition={ringProps.transition}
    />
  );
}

/**
 * The single ArrowUp that floats up from the Boost button and fades on success.
 * Anchored top-center of its `relative` wrapper; `will-change: transform` keeps it
 * compositor-only. Suppressed under reduced motion by the hook (never sets `show`).
 */
export function BoostArrowFloat({
  show,
  arrowProps,
  size = 20,
}: {
  show: boolean;
  arrowProps: RingProps;
  size?: number;
}) {
  return (
    <AnimatePresence>
      {show && (
        <motion.span
          key="boost-arrow"
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 text-primary"
          style={{ willChange: "transform" }}
          initial={arrowProps.initial}
          animate={arrowProps.animate}
          exit={{ opacity: 0 }}
          transition={arrowProps.transition}
        >
          <ArrowUp size={size} weight="bold" />
        </motion.span>
      )}
    </AnimatePresence>
  );
}
