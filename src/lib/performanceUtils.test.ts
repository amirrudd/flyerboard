import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { debounce, throttle } from './performanceUtils';

describe('performanceUtils', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('debounce', () => {
        it('should delay execution', () => {
            const fn = vi.fn();
            const debouncedFn = debounce(fn, 100);

            debouncedFn();
            expect(fn).not.toHaveBeenCalled();

            vi.advanceTimersByTime(50);
            expect(fn).not.toHaveBeenCalled();

            vi.advanceTimersByTime(51);
            expect(fn).toHaveBeenCalledTimes(1);
        });

        it('should reset timer on subsequent calls', () => {
            const fn = vi.fn();
            const debouncedFn = debounce(fn, 100);

            debouncedFn();
            vi.advanceTimersByTime(50);
            debouncedFn(); // Reset timer

            vi.advanceTimersByTime(50);
            expect(fn).not.toHaveBeenCalled();

            vi.advanceTimersByTime(51);
            expect(fn).toHaveBeenCalledTimes(1);
        });
    });

    describe('throttle', () => {
        it('should execute immediately on first call', () => {
            const fn = vi.fn();
            const throttledFn = throttle(fn, 100);

            throttledFn();
            expect(fn).toHaveBeenCalledTimes(1);
        });

        it('should ignore calls within the delay period', () => {
            const fn = vi.fn();
            const throttledFn = throttle(fn, 100);

            throttledFn();
            expect(fn).toHaveBeenCalledTimes(1);

            throttledFn();
            throttledFn();
            expect(fn).toHaveBeenCalledTimes(1);

            vi.advanceTimersByTime(100);
            // The trailing call should execute
            expect(fn).toHaveBeenCalledTimes(2);
        });

        it('should execute trailing call after delay', () => {
            const fn = vi.fn();
            const throttledFn = throttle(fn, 100);

            throttledFn();
            vi.advanceTimersByTime(50);
            throttledFn(); // Scheduled for t=100

            expect(fn).toHaveBeenCalledTimes(1);

            vi.advanceTimersByTime(50);
            expect(fn).toHaveBeenCalledTimes(2);
        });
    });
});
