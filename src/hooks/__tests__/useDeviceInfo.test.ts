import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useDeviceInfo } from '../useDeviceInfo';

describe('useDeviceInfo', () => {
    beforeEach(() => {
        // Reset window size
        Object.defineProperty(window, 'innerWidth', {
            writable: true,
            configurable: true,
            value: 1024,
        });
    });

    it('should detect desktop on wide screen', () => {
        Object.defineProperty(window, 'innerWidth', { value: 1024 });

        const { result } = renderHook(() => useDeviceInfo());

        expect(result.current.isDesktop).toBe(true);
        expect(result.current.isMobile).toBe(false);
        expect(result.current.isTablet).toBe(false);
    });

    it('should detect mobile on narrow screen', () => {
        Object.defineProperty(window, 'innerWidth', { value: 375 });

        const { result } = renderHook(() => useDeviceInfo());

        expect(result.current.isMobile).toBe(true);
        expect(result.current.isDesktop).toBe(false);
        expect(result.current.isTablet).toBe(false);
    });

    it('should detect tablet on medium screen', () => {
        Object.defineProperty(window, 'innerWidth', { value: 800 });

        const { result } = renderHook(() => useDeviceInfo());

        expect(result.current.isTablet).toBe(true);
        expect(result.current.isMobile).toBe(false);
        expect(result.current.isDesktop).toBe(false);
    });

    it('should update on window resize', () => {
        Object.defineProperty(window, 'innerWidth', { value: 1024 });

        const { result, rerender } = renderHook(() => useDeviceInfo());
        expect(result.current.isDesktop).toBe(true);

        // Simulate resize
        act(() => {
            Object.defineProperty(window, 'innerWidth', { value: 375 });
            window.dispatchEvent(new Event('resize'));
        });

        rerender();
        expect(result.current.isMobile).toBe(true);
    });

    it('should detect touch device', () => {
        Object.defineProperty(window, 'ontouchstart', { value: {} });

        const { result } = renderHook(() => useDeviceInfo());
        expect(result.current.isTouchDevice).toBe(true);
    });
});
