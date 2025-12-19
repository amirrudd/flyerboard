import { useState, useEffect, useMemo } from 'react';

export interface DeviceInfo {
    isMobile: boolean;
    isTablet: boolean;
    isDesktop: boolean;
    isIOS: boolean;
    isAndroid: boolean;
    isSafari: boolean;
    isChrome: boolean;
    isTouchDevice: boolean;
}

/**
 * Hook for detecting device type and platform
 * Uses User-Agent + feature detection for accuracy
 * Memoized to prevent unnecessary re-renders
 * 
 * @returns DeviceInfo object with platform detection flags
 * 
 * @example
 * const { isMobile, isIOS, isTouchDevice } = useDeviceInfo();
 */
export function useDeviceInfo(): DeviceInfo {
    const [windowWidth, setWindowWidth] = useState(
        typeof window !== 'undefined' ? window.innerWidth : 1024
    );

    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const deviceInfo = useMemo((): DeviceInfo => {
        if (typeof window === 'undefined') {
            // SSR fallback
            return {
                isMobile: false,
                isTablet: false,
                isDesktop: true,
                isIOS: false,
                isAndroid: false,
                isSafari: false,
                isChrome: false,
                isTouchDevice: false,
            };
        }

        const userAgent = navigator.userAgent || '';

        // Platform detection
        const isIOS = /iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream;
        const isAndroid = /Android/.test(userAgent);

        // Browser detection
        const isSafari = /^((?!chrome|android).)*safari/i.test(userAgent);
        const isChrome = /Chrome/.test(userAgent) && /Google Inc/.test(navigator.vendor);

        // Touch detection
        const isTouchDevice =
            'ontouchstart' in window ||
            navigator.maxTouchPoints > 0 ||
            (navigator as any).msMaxTouchPoints > 0;

        // Screen size detection (responsive)
        const isMobile = windowWidth < 768;
        const isTablet = windowWidth >= 768 && windowWidth < 1024;
        const isDesktop = windowWidth >= 1024;

        return {
            isMobile,
            isTablet,
            isDesktop,
            isIOS,
            isAndroid,
            isSafari,
            isChrome,
            isTouchDevice,
        };
    }, [windowWidth]);

    return deviceInfo;
}
