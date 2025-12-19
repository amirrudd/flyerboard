import { useDeviceInfo } from './useDeviceInfo';
import { useMemo } from 'react';

export interface PlatformStyles {
    scrollContainer: React.CSSProperties;
    nestedScrollContainer: React.CSSProperties;
    fullHeightContainer: string; // Tailwind classes
    safeAreaPadding: {
        top: string;
        bottom: string;
        left: string;
        right: string;
    };
}

/**
 * Hook for platform-specific style helpers
 * Returns optimized styles for current platform
 * 
 * @returns PlatformStyles object with platform-optimized styles
 * 
 * @example
 * const { scrollContainer, nestedScrollContainer } = usePlatformStyles();
 * <div style={scrollContainer}>...</div>
 */
export function usePlatformStyles(): PlatformStyles {
    const { isIOS, isMobile } = useDeviceInfo();

    const styles = useMemo((): PlatformStyles => {
        return {
            // Main scroll container styles
            scrollContainer: {
                WebkitOverflowScrolling: 'touch',
                overscrollBehavior: 'contain',
                touchAction: 'manipulation',
            },

            // Nested scroll container styles (chat messages, lists)
            nestedScrollContainer: {
                touchAction: 'pan-y',
                overscrollBehavior: 'contain',
            },

            // Full height container classes (mobile vs desktop)
            fullHeightContainer: isMobile
                ? 'fixed inset-0 flex flex-col'
                : 'relative min-h-screen flex flex-col',

            // Safe area padding (iOS notch/home indicator)
            safeAreaPadding: {
                top: isIOS ? 'env(safe-area-inset-top, 0px)' : '0px',
                bottom: isIOS ? 'env(safe-area-inset-bottom, 0px)' : '0px',
                left: isIOS ? 'env(safe-area-inset-left, 0px)' : '0px',
                right: isIOS ? 'env(safe-area-inset-right, 0px)' : '0px',
            },
        };
    }, [isIOS, isMobile]);

    return styles;
}
