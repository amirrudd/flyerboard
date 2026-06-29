// Bridge between HomePage (which owns scroll refs) and BottomNav (which triggers
// scroll-to-top). HomePage registers its callback on mount and unregisters on
// unmount; BottomNav calls triggerHomeScrollToTop() without needing the refs.
// Also exposes the shared sessionStorage key both modules read/write.

export const HOME_SCROLL_KEY = "homeScrollTop";

let scrollToTop: (() => void) | null = null;

export function registerHomeScroll(fn: () => void) {
  scrollToTop = fn;
}

export function unregisterHomeScroll() {
  scrollToTop = null;
}

export function triggerHomeScrollToTop() {
  scrollToTop?.();
}
