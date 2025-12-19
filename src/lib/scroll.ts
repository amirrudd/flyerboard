/**
 * Scroll utility functions
 * Helpers for managing scroll behavior across platforms
 */

/**
 * Prevent scroll on an element
 * @param element - Element to prevent scroll on
 */
export function preventScroll(element: HTMLElement): void {
    element.style.overflow = 'hidden';
    element.style.touchAction = 'none';
}

/**
 * Allow scroll on an element
 * @param element - Element to allow scroll on
 */
export function allowScroll(element: HTMLElement): void {
    element.style.overflow = '';
    element.style.touchAction = '';
}

/**
 * Scroll to top of element smoothly
 * @param element - Element to scroll
 */
export function scrollToTop(element: HTMLElement | Window = window): void {
    if (element instanceof Window) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
        element.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

/**
 * Scroll to bottom of element smoothly
 * @param element - Element to scroll
 */
export function scrollToBottom(element: HTMLElement): void {
    element.scrollTo({ top: element.scrollHeight, behavior: 'smooth' });
}

/**
 * Check if element is scrolled to bottom
 * @param element - Element to check
 * @param threshold - Threshold in pixels (default: 50)
 */
export function isScrolledToBottom(element: HTMLElement, threshold: number = 50): boolean {
    return element.scrollHeight - element.scrollTop - element.clientHeight < threshold;
}

/**
 * Check if element is scrolled to top
 * @param element - Element to check
 * @param threshold - Threshold in pixels (default: 10)
 */
export function isScrolledToTop(element: HTMLElement, threshold: number = 10): boolean {
    return element.scrollTop < threshold;
}

/**
 * Get scroll position of element or window
 * @param element - Element to get scroll position from (default: window)
 */
export function getScrollPosition(element?: HTMLElement): { x: number; y: number } {
    if (!element) {
        return {
            x: window.scrollX || window.pageXOffset,
            y: window.scrollY || window.pageYOffset,
        };
    }

    return {
        x: element.scrollLeft,
        y: element.scrollTop,
    };
}

/**
 * Set scroll position of element or window
 * @param position - Position to scroll to
 * @param element - Element to scroll (default: window)
 * @param smooth - Use smooth scrolling (default: false)
 */
export function setScrollPosition(
    position: { x?: number; y?: number },
    element?: HTMLElement,
    smooth: boolean = false
): void {
    const behavior = smooth ? 'smooth' : 'auto';

    if (!element) {
        window.scrollTo({
            left: position.x,
            top: position.y,
            behavior,
        });
    } else {
        element.scrollTo({
            left: position.x,
            top: position.y,
            behavior,
        });
    }
}

/**
 * Scroll element into view with options
 * @param element - Element to scroll into view
 * @param options - Scroll options
 */
export function scrollIntoView(
    element: HTMLElement,
    options: ScrollIntoViewOptions = { behavior: 'smooth', block: 'nearest' }
): void {
    element.scrollIntoView(options);
}
