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

    describe('boostLaunch (Phase 3 success sequence)', () => {
        it('lifts the card with a tween keyframe (never a spring on the return)', () => {
            const { result } = renderHook(() => useMotionPrefs());
            const { lift } = result.current.boostLaunch();

            expect(lift).toMatchObject({
                y: [0, -10, 0],
                transition: { duration: 0.5, times: [0, 0.4, 1] },
            });
            // Binding UX spec: a tween, not a spring (a spring on a keyframe array can undershoot the return).
            expect((lift as { transition: { type?: string } }).transition).not.toHaveProperty('type');
        });

        it('floats the ArrowUp up-and-out over 0.5s and pulses the ring via opacity', () => {
            const { result } = renderHook(() => useMotionPrefs());
            const { arrow, ring } = result.current.boostLaunch();

            expect(arrow.initial).toMatchObject({ opacity: 1, y: -4 });
            expect(arrow.animate).toMatchObject({ opacity: 0, y: -24 });
            expect(arrow.transition).toMatchObject({ duration: 0.5 });
            // Ring is opacity-only (no border/box-shadow animation).
            expect(ring.initial).toEqual({ opacity: 0.6 });
            expect(ring.animate).toEqual({ opacity: 0 });
        });

        it('degrades to a brief opacity confirmation only under reduced motion (no lift, no float)', () => {
            mocks.reduced = true;
            const { result } = renderHook(() => useMotionPrefs());
            const { lift, arrow, ring } = result.current.boostLaunch();

            // Lift becomes a brief opacity blip — no vertical movement.
            expect(lift).not.toHaveProperty('y');
            expect(lift).toMatchObject({ opacity: [1, 0.6, 1] });
            // Float and ring pulse are both suppressed (start invisible).
            expect(arrow.initial).toMatchObject({ opacity: 0 });
            expect(ring.initial).toEqual({ opacity: 0 });
        });
    });
});
