/**
 * Performance utility functions for debouncing and throttling
 */

/**
 * Debounce function - delays execution until after a specified delay has passed
 * since the last invocation. Useful for search inputs and other high-frequency events.
 * 
 * @param fn - The function to debounce
 * @param delay - The delay in milliseconds
 * @returns A debounced version of the function
 */
export function debounce<T extends (...args: any[]) => any>(
    fn: T,
    delay: number
): (...args: Parameters<T>) => void {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    return function debounced(...args: Parameters<T>) {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }

        timeoutId = setTimeout(() => {
            fn(...args);
            timeoutId = null;
        }, delay);
    };
}

/**
 * Throttle function - ensures a function is called at most once per specified interval.
 * Useful for resize, scroll, and other continuous events.
 * 
 * @param fn - The function to throttle
 * @param delay - The minimum interval in milliseconds between calls
 * @returns A throttled version of the function
 */
export function throttle<T extends (...args: any[]) => any>(
    fn: T,
    delay: number
): (...args: Parameters<T>) => void {
    let lastCall = 0;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    return function throttled(...args: Parameters<T>) {
        const now = Date.now();
        const timeSinceLastCall = now - lastCall;

        if (timeSinceLastCall >= delay) {
            // Enough time has passed, call immediately
            lastCall = now;
            fn(...args);
        } else {
            // Schedule a call for when the delay period is over
            if (timeoutId) {
                clearTimeout(timeoutId);
            }

            timeoutId = setTimeout(() => {
                lastCall = Date.now();
                fn(...args);
                timeoutId = null;
            }, delay - timeSinceLastCall);
        }
    };
}
