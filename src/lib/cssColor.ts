/** Last-resort brand color, used when the `--primary` CSS token can't be read
 *  (e.g. no DOM during SSR, or the variable is unset). */
export const FALLBACK_PRIMARY = '#9e1b1e';

/**
 * Resolve the brand primary color from the `--primary` CSS variable as an
 * `hsl(...)` string, falling back to {@link FALLBACK_PRIMARY} when the DOM or
 * token is unavailable.
 *
 * Reads the DOM once per call (a `getComputedStyle` reflow), so cache the result
 * with `useMemo(resolvePrimaryColor, [])` in components rather than calling it
 * every render.
 */
export function resolvePrimaryColor(): string {
    if (typeof document === 'undefined') return FALLBACK_PRIMARY;
    const primaryHsl = getComputedStyle(document.documentElement)
        .getPropertyValue('--primary')
        .trim();
    return primaryHsl ? `hsl(${primaryHsl})` : FALLBACK_PRIMARY;
}
