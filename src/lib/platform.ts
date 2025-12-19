/**
 * Platform detection utilities
 * Static utilities for server-side or one-time checks
 */

// Detect iOS
export const isIOS = typeof window !== 'undefined' &&
    /iPad|iPhone|iPod/.test(navigator.userAgent) &&
    !(window as any).MSStream;

// Detect Android
export const isAndroid = typeof window !== 'undefined' &&
    /Android/.test(navigator.userAgent);

// Detect touch device
export const isTouchDevice = typeof window !== 'undefined' && (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    (navigator as any).msMaxTouchPoints > 0
);

// Detect Safari
export const isSafari = typeof window !== 'undefined' &&
    /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

// Detect Chrome
export const isChrome = typeof window !== 'undefined' &&
    /Chrome/.test(navigator.userAgent) &&
    /Google Inc/.test(navigator.vendor);

/**
 * Get safe area insets for iOS notch/home indicator
 * Returns pixel values for top, bottom, left, right
 */
export function getSafeAreaInsets(): {
    top: number;
    bottom: number;
    left: number;
    right: number;
} {
    if (typeof window === 'undefined' || !isIOS) {
        return { top: 0, bottom: 0, left: 0, right: 0 };
    }

    // Try to get from CSS env() variables
    const computedStyle = getComputedStyle(document.documentElement);

    const parseInset = (value: string): number => {
        const parsed = parseInt(value, 10);
        return isNaN(parsed) ? 0 : parsed;
    };

    return {
        top: parseInset(computedStyle.getPropertyValue('--safe-area-inset-top')),
        bottom: parseInset(computedStyle.getPropertyValue('--safe-area-inset-bottom')),
        left: parseInset(computedStyle.getPropertyValue('--safe-area-inset-left')),
        right: parseInset(computedStyle.getPropertyValue('--safe-area-inset-right')),
    };
}

/**
 * Check if device is in landscape orientation
 */
export function isLandscape(): boolean {
    if (typeof window === 'undefined') return false;
    return window.innerWidth > window.innerHeight;
}

/**
 * Check if device is in portrait orientation
 */
export function isPortrait(): boolean {
    return !isLandscape();
}

/**
 * Get viewport dimensions accounting for browser chrome
 */
export function getViewportDimensions(): { width: number; height: number } {
    if (typeof window === 'undefined') {
        return { width: 1024, height: 768 };
    }

    return {
        width: window.innerWidth,
        height: window.innerHeight,
    };
}
