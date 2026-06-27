import { useReducedMotion } from "framer-motion";

const EASE: [number, number, number, number] = [0.2, 0.8, 0.2, 1];

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

  return { reduced, fadeUp, whileInView, staggerCard };
}
