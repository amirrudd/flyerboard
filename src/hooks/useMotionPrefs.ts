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

  /**
   * Boost feed-arrival "pin drop" (Boost feature, Jul 2026): the card drops
   * onto the board from slightly above, slightly oversized, and settles with a
   * ~4% spring overshoot "thunk" — a flyer being pinned to the board. These are
   * the codebase's FIRST springs (everything else here is a tween); deliberate,
   * per the UX-refined Boost spec. No rotate — it reads as misalignment on a
   * rectangular grid card. Key the card on `${ad._id}:${ad.bumpedAt}` so a
   * later boost re-animates but plain re-renders don't. Under
   * prefers-reduced-motion: a plain 0.2s opacity fade only.
   */
  function boostPinDrop() {
    return {
      initial: { opacity: 0, y: reduced ? 0 : -14, scale: reduced ? 1 : 1.06 },
      animate: { opacity: 1, y: 0, scale: 1 },
      transition: reduced
        ? ({ duration: 0.2, ease: EASE } as const)
        : ({ type: "spring", stiffness: 260, damping: 22, mass: 0.9 } as const),
    } as const;
  }

  /**
   * Boost arrival ring pulse: an opacity-animated overlay (0.6 → 0 over ~1.2s)
   * on a sibling `absolute inset-0 ring-2 ring-primary pointer-events-none`
   * div — the transient "look here" cue that replaces the New badge boosted
   * ads deliberately don't get. Compositor-only by design: NEVER animate
   * border or box-shadow for this (borders shift layout; animated box-shadow
   * janks a 30-card mount). Under prefers-reduced-motion the pulse is skipped
   * entirely (starts and stays at opacity 0).
   */
  function boostRingPulse() {
    return {
      initial: { opacity: reduced ? 0 : 0.6 },
      animate: { opacity: 0 },
      transition: { duration: reduced ? 0 : 1.2, ease: EASE },
    } as const;
  }

  /**
   * Boost success "launch" sequence (Boost feature, Jul 2026 — the owner's payoff
   * moment on the dashboard/detail card). Returns three coordinated parts:
   *
   *   - `lift`: pass to an imperative `controls.start(...)`. Full motion is a TWEEN
   *     keyframe `y: [0,-10,0]` (a spring on a keyframe array can undershoot the
   *     return, so this is deliberately a tween reusing EASE). Under
   *     prefers-reduced-motion it collapses to a brief opacity confirmation only
   *     (no lift, no float) — the sole cue reduced-motion users get.
   *   - `ring`: the SAME opacity-overlay technique as `boostRingPulse` (never an
   *     animated border/box-shadow). Render on a sibling
   *     `absolute inset-0 rounded-2xl ring-2 ring-primary` div, remounted per boost.
   *   - `arrow`: a lucide/phosphor ArrowUp on a `motion.span` that floats up and
   *     fades (`y: -4 → -24`, opacity `1 → 0`, 0.5s) inside AnimatePresence; add
   *     `will-change: transform` at the call site. Suppressed under reduced motion.
   *
   * Total sequence stays under ~1s so it never feels like it blocks the UI.
   */
  function boostLaunch() {
    const lift = reduced
      ? { opacity: [1, 0.6, 1], transition: { duration: 0.3, ease: EASE } }
      : { y: [0, -10, 0], transition: { duration: 0.5, ease: EASE, times: [0, 0.4, 1] } };
    const ring = {
      initial: { opacity: reduced ? 0 : 0.6 },
      animate: { opacity: 0 },
      transition: { duration: reduced ? 0 : 0.6, ease: EASE },
    };
    const arrow = {
      initial: { opacity: reduced ? 0 : 1, y: reduced ? -24 : -4 },
      animate: { opacity: 0, y: -24 },
      transition: { duration: reduced ? 0 : 0.5, ease: EASE },
    };
    return { lift, ring, arrow };
  }

  /**
   * Full-screen panel slide-over (e.g. inbox → thread on mobile): fade +
   * 24px slide from the right, 200ms ease-out. Exit (when used inside
   * AnimatePresence) reverses back out to the right with a shorter ease-in.
   * Collapses to no-motion under prefers-reduced-motion.
   */
  function slideOver() {
    return {
      initial: { opacity: 0, x: reduced ? 0 : 24 },
      animate: { opacity: 1, x: 0 },
      exit: {
        opacity: 0,
        x: reduced ? 0 : 24,
        transition: { duration: reduced ? 0 : 0.15, ease: EASE_IN },
      },
      transition: { duration: reduced ? 0 : 0.2, ease: EASE },
    } as const;
  }

  return { reduced, fadeUp, whileInView, staggerCard, slideStep, bubbleIn, listStagger, scalePop, slideOver, boostPinDrop, boostRingPulse, boostLaunch };
}
