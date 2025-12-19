import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useScrollLock } from '../useScrollLock';

describe('useScrollLock', () => {
    beforeEach(() => {
        // Reset body styles
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';

        // Mock scroll position
        window.scrollY = 100;
    });

    afterEach(() => {
        // Cleanup
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
    });

    it('should lock scroll when lockScroll is called', () => {
        const { result } = renderHook(() => useScrollLock());

        act(() => {
            result.current.lockScroll();
        });

        expect(result.current.isLocked).toBe(true);
        expect(document.body.style.position).toBe('fixed');
        expect(document.body.style.overflow).toBe('hidden');
        expect(document.documentElement.style.overflow).toBe('hidden');
    });

    it('should unlock scroll when unlockScroll is called', () => {
        const { result } = renderHook(() => useScrollLock());

        act(() => {
            result.current.lockScroll();
        });

        expect(result.current.isLocked).toBe(true);

        act(() => {
            result.current.unlockScroll();
        });

        expect(result.current.isLocked).toBe(false);
        expect(document.body.style.position).toBe('');
        expect(document.body.style.overflow).toBe('');
    });

    it('should save and restore scroll position', () => {
        const scrollToMock = vi.fn();
        window.scrollTo = scrollToMock;
        window.scrollY = 250;

        const { result } = renderHook(() => useScrollLock());

        act(() => {
            result.current.lockScroll();
        });

        expect(document.body.style.top).toBe('-250px');

        act(() => {
            result.current.unlockScroll();
        });

        expect(scrollToMock).toHaveBeenCalledWith(0, 250);
    });

    it('should cleanup on unmount if locked', () => {
        const { result, unmount } = renderHook(() => useScrollLock());

        act(() => {
            result.current.lockScroll();
        });

        expect(result.current.isLocked).toBe(true);

        unmount();

        // Should restore styles on unmount
        expect(document.body.style.position).toBe('');
    });
});
