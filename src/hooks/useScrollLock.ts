import { useCallback, useEffect, useRef, useState } from 'react';

export interface ScrollLockAPI {
    lockScroll: () => void;
    unlockScroll: () => void;
    isLocked: boolean;
}

/**
 * Hook for locking/unlocking body scroll
 * Handles iOS-specific scroll locking (position: fixed approach)
 * Handles Android scroll locking (overflow: hidden)
 * Restores scroll position on unlock
 * 
 * @returns ScrollLockAPI with lock/unlock functions and isLocked state
 * 
 * @example
 * const { lockScroll, unlockScroll, isLocked } = useScrollLock();
 * 
 * // Lock when modal opens
 * useEffect(() => {
 *   if (isModalOpen) {
 *     lockScroll();
 *     return () => unlockScroll();
 *   }
 * }, [isModalOpen]);
 */
export function useScrollLock(): ScrollLockAPI {
    const [isLocked, setIsLocked] = useState(false);
    const scrollPositionRef = useRef(0);
    const originalStylesRef = useRef({
        position: '',
        top: '',
        width: '',
        overflow: '',
    });

    const lockScroll = useCallback(() => {
        if (typeof window === 'undefined') return;

        // Save current scroll position
        scrollPositionRef.current = window.scrollY;

        // Save original styles
        originalStylesRef.current = {
            position: document.body.style.position,
            top: document.body.style.top,
            width: document.body.style.width,
            overflow: document.body.style.overflow,
        };

        // Apply scroll lock
        document.body.style.position = 'fixed';
        document.body.style.top = `-${scrollPositionRef.current}px`;
        document.body.style.width = '100%';
        document.body.style.overflow = 'hidden';

        // Also lock html element for better cross-browser support
        document.documentElement.style.overflow = 'hidden';

        setIsLocked(true);
    }, []);

    const unlockScroll = useCallback(() => {
        if (typeof window === 'undefined') return;

        // Restore original styles
        document.body.style.position = originalStylesRef.current.position;
        document.body.style.top = originalStylesRef.current.top;
        document.body.style.width = originalStylesRef.current.width;
        document.body.style.overflow = originalStylesRef.current.overflow;
        document.documentElement.style.overflow = '';

        // Restore scroll position
        window.scrollTo(0, scrollPositionRef.current);

        setIsLocked(false);
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (isLocked) {
                unlockScroll();
            }
        };
    }, [isLocked, unlockScroll]);

    return {
        lockScroll,
        unlockScroll,
        isLocked,
    };
}
