import { useReducedMotion } from "framer-motion";

const EASE: [number, number, number, number] = [0.2, 0.8, 0.2, 1];
// Ease-in curve for exits (contract: exits are shorter + ease-in).
const EASE_IN: [number, number, number, number] = [0.4, 0, 1, 1];

export function useMotionPrefs() {
  const reduced = useReducedMotion() ?? false;

  function fadeUp(delay = 0) {
    return {
      initial: { opacity: 0, y: reduced ? 0 : 12 },
      animate: { opacity: 1, y: 0 },
      transition: { delay: reduced ? 0 : delay, duration: reduced ? 0 : 0.4, ease: EASE },
    } as const;
  }

  function whileInView(delay = 0) {
    return {
      initial: { opacity: 0, y: reduced ? 0 : 12 },
      whileInView: { opacity: 1, y: 0 },
      viewport: { once: true },
      transition: { delay: reduced ? 0 : delay, duration: reduced ? 0 : 0.4, ease: EASE },
    } as const;
  }

  function staggerCard(index: number, cap = 18, step = 0.028) {
    return {
      initial: { opacity: 0, y: reduced ? 0 : 10 },
      animate: { opacity: 1, y: 0 },
      transition: {
        delay: reduced ? 0 : (index < cap ? index * step : 0),
        duration: reduced ? 0 : 0.4,
        ease: EASE,
      },
    } as const;
  }

  /**
   * Chat message bubble entrance: fade + 8px rise, 180ms ease-out.
   * Exit (when used inside AnimatePresence) is a shorter 120ms ease-in fade.
   * Collapses to no-motion under prefers-reduced-motion.
   */
  function bubbleIn(delay = 0) {
    return {
      initial: { opacity: 0, y: reduced ? 0 : 8 },
      animate: { opacity: 1, y: 0 },
      exit: {
        opacity: 0,
        transition: { duration: reduced ? 0 : 0.12, ease: EASE_IN },
      },
      transition: {
        delay: reduced ? 0 : delay,
        duration: reduced ? 0 : 0.18,
        ease: EASE,
      },
    } as const;
  }

  /**
   * List item entrance with 40ms per-item stagger (capped): fade + 8px rise,
   * 220ms ease-out. Exit is a shorter 150ms ease-in fade for AnimatePresence
   * removals. Collapses to no-motion under prefers-reduced-motion.
   */
  function listStagger(index: number, cap = 12, step = 0.04) {
    return {
      initial: { opacity: 0, y: reduced ? 0 : 8 },
      animate: { opacity: 1, y: 0 },
      exit: {
        opacity: 0,
        transition: { duration: reduced ? 0 : 0.15, ease: EASE_IN },
      },
      transition: {
        delay: reduced ? 0 : (index < cap ? index * step : 0),
        duration: reduced ? 0 : 0.22,
        ease: EASE,
      },
    } as const;
  }

  /**
   * Badge/counter pop: scale 0.8 → 1 + fade, 200ms ease-out. Re-key the
   * element on value change to replay. Collapses to opacity-only (no scale)
   * under prefers-reduced-motion.
   */
  function scalePop() {
    return {
      initial: { opacity: 0, scale: reduced ? 1 : 0.8 },
      animate: { opacity: 1, scale: 1 },
      transition: { duration: reduced ? 0 : 0.2, ease: EASE },
    } as const;
  }

  /** Horizontal slide in/out — for step-wizard transitions (e.g. BundleFlow). */
  function slideStep() {
    return {
      initial: { opacity: 0, x: reduced ? 0 : 24 },
      animate: { opacity: 1, x: 0 },
      exit: { opacity: 0, x: reduced ? 0 : -24 },
      transition: { duration: reduced ? 0 : 0.28, ease: EASE },
    } as const;
  }

  return { reduced, fadeUp, whileInView, staggerCard, slideStep, bubbleIn, listStagger, scalePop };
}
