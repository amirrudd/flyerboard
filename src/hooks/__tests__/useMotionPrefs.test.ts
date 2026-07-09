import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useMotionPrefs } from '../useMotionPrefs';

const mocks = vi.hoisted(() => ({ reduced: false }));

vi.mock('framer-motion', () => ({
    useReducedMotion: () => mocks.reduced,
}));

describe('useMotionPrefs — boost helpers (Boost, Phase 2)', () => {
    beforeEach(() => {
        mocks.reduced = false;
    });

    describe('boostPinDrop', () => {
        it('drops from above, slightly oversized, and settles with the spec spring', () => {
            const { result } = renderHook(() => useMotionPrefs());
            const props = result.current.boostPinDrop();

            expect(props.initial).toEqual({ opacity: 0, y: -14, scale: 1.06 });
            expect(props.animate).toEqual({ opacity: 1, y: 0, scale: 1 });
            expect(props.transition).toEqual({
                type: 'spring',
                stiffness: 260,
                damping: 22,
                mass: 0.9,
            });
            // Binding UX spec: NO rotate — it reads as misalignment on a grid card.
            expect(props.initial).not.toHaveProperty('rotate');
            expect(props.animate).not.toHaveProperty('rotate');
        });

        it('degrades to a plain 0.2s opacity fade under prefers-reduced-motion', () => {
            mocks.reduced = true;
            const { result } = renderHook(() => useMotionPrefs());
            const props = result.current.boostPinDrop();

            // No movement, no scale change — opacity only.
            expect(props.initial).toEqual({ opacity: 0, y: 0, scale: 1 });
            expect(props.animate).toEqual({ opacity: 1, y: 0, scale: 1 });
            // Tween fade, not a spring.
            expect(props.transition).not.toHaveProperty('type');
            expect(props.transition).toMatchObject({ duration: 0.2 });
        });
    });

    describe('boostRingPulse', () => {
        it('fades the ring overlay 0.6 → 0 over ~1.2s (compositor-only opacity)', () => {
            const { result } = renderHook(() => useMotionPrefs());
            const props = result.current.boostRingPulse();

            expect(props.initial).toEqual({ opacity: 0.6 });
            expect(props.animate).toEqual({ opacity: 0 });
            expect(props.transition).toMatchObject({ duration: 1.2 });
        });

        it('is suppressed entirely under prefers-reduced-motion', () => {
            mocks.reduced = true;
            const { result } = renderHook(() => useMotionPrefs());
            const props = result.current.boostRingPulse();

            // Starts and stays invisible — no pulse.
            expect(props.initial).toEqual({ opacity: 0 });
            expect(props.animate).toEqual({ opacity: 0 });
            expect(props.transition).toMatchObject({ duration: 0 });
        });
    });
});
