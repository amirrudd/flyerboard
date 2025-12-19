import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useMediaQuery } from '../useMediaQuery';

describe('useMediaQuery', () => {
    let matchMediaMock: any;

    beforeEach(() => {
        // Mock window.matchMedia
        matchMediaMock = vi.fn((query: string) => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        }));

        Object.defineProperty(window, 'matchMedia', {
            writable: true,
            value: matchMediaMock,
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('should return false initially when query does not match', () => {
        matchMediaMock.mockReturnValue({
            matches: false,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        });

        const { result } = renderHook(() => useMediaQuery('(max-width: 768px)'));
        expect(result.current).toBe(false);
    });

    it('should return true when query matches', () => {
        matchMediaMock.mockReturnValue({
            matches: true,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        });

        const { result } = renderHook(() => useMediaQuery('(max-width: 768px)'));
        expect(result.current).toBe(true);
    });

    it('should update when media query changes', () => {
        let listener: ((e: any) => void) | null = null;

        matchMediaMock.mockReturnValue({
            matches: false,
            addEventListener: vi.fn((event, callback) => {
                listener = callback;
            }),
            removeEventListener: vi.fn(),
        });

        const { result } = renderHook(() => useMediaQuery('(max-width: 768px)'));
        expect(result.current).toBe(false);

        // Simulate media query change
        act(() => {
            listener?.({ matches: true });
        });

        expect(result.current).toBe(true);
    });

    it('should cleanup listener on unmount', () => {
        const removeEventListener = vi.fn();

        matchMediaMock.mockReturnValue({
            matches: false,
            addEventListener: vi.fn(),
            removeEventListener,
        });

        const { unmount } = renderHook(() => useMediaQuery('(max-width: 768px)'));
        unmount();

        expect(removeEventListener).toHaveBeenCalled();
    });
});
