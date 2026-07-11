import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useMotionPrefs } from './useMotionPrefs';

// Drive prefers-reduced-motion directly instead of via matchMedia plumbing.
const mockUseReducedMotion = vi.fn<() => boolean>(() => false);
vi.mock('framer-motion', () => ({
    useReducedMotion: () => mockUseReducedMotion(),
}));

describe('useMotionPrefs — slideOver', () => {
    it('slides in from the right (24px, 200ms)', () => {
        mockUseReducedMotion.mockReturnValue(false);
        const { result } = renderHook(() => useMotionPrefs());

        const props = result.current.slideOver();
        expect(props.initial).toEqual({ opacity: 0, x: 24 });
        expect(props.animate).toEqual({ opacity: 1, x: 0 });
        expect(props.transition.duration).toBe(0.2);
    });

    it('collapses to zero duration and zero offset under prefers-reduced-motion', () => {
        mockUseReducedMotion.mockReturnValue(true);
        const { result } = renderHook(() => useMotionPrefs());

        expect(result.current.reduced).toBe(true);
        const props = result.current.slideOver();
        expect(props.initial).toEqual({ opacity: 0, x: 0 });
        expect(props.transition.duration).toBe(0);
    });
});
