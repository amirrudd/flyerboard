import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    getTimerState,
    setTimerState,
    clearTimerState,
    clearAllTimers,
} from './otpTimerStorage';

describe('otpTimerStorage', () => {
    beforeEach(() => {
        // Clear localStorage before each test - vitest uses happy-dom which needs manual clearing
        for (const key in localStorage) {
            localStorage.removeItem(key);
        }
        vi.clearAllMocks();
    });

    afterEach(() => {
        // Clear localStorage after each test
        for (const key in localStorage) {
            localStorage.removeItem(key);
        }
    });

    describe('setTimerState and getTimerState', () => {
        it('should store and retrieve timer state', () => {
            const phoneNumber = '0412345678';
            setTimerState(phoneNumber, 60);

            const remaining = getTimerState(phoneNumber);
            expect(remaining).toBeGreaterThan(58); // Should be close to 60
            expect(remaining).toBeLessThanOrEqual(60);
        });

        it('should return 0 for non-existent timer', () => {
            const remaining = getTimerState('0400000000');
            expect(remaining).toBe(0);
        });

        it('should return 0 for expired timer', () => {
            const phoneNumber = '0412345678';
            // Set timer that expired 1 second ago
            const expiresAt = Date.now() - 1000;
            localStorage.setItem(
                `otp_timer_${phoneNumber}`,
                JSON.stringify({ phoneNumber, expiresAt })
            );

            const remaining = getTimerState(phoneNumber);
            expect(remaining).toBe(0);
        });

        it('should clean up expired timer', () => {
            const phoneNumber = '0412345678';
            const expiresAt = Date.now() - 1000;
            localStorage.setItem(
                `otp_timer_${phoneNumber}`,
                JSON.stringify({ phoneNumber, expiresAt })
            );

            getTimerState(phoneNumber);

            // Timer should be removed from localStorage
            const stored = localStorage.getItem(`otp_timer_${phoneNumber}`);
            expect(stored).toBeNull();
        });

        it('should handle different phone numbers independently', () => {
            const phone1 = '0412345678';
            const phone2 = '0487654321';

            setTimerState(phone1, 60);
            setTimerState(phone2, 30);

            const remaining1 = getTimerState(phone1);
            const remaining2 = getTimerState(phone2);

            expect(remaining1).toBeGreaterThan(58);
            expect(remaining2).toBeGreaterThan(28);
            expect(remaining2).toBeLessThan(remaining1);
        });
    });

    describe('clearTimerState', () => {
        it('should remove timer for specific phone number', () => {
            const phoneNumber = '0412345678';
            setTimerState(phoneNumber, 60);

            clearTimerState(phoneNumber);

            const remaining = getTimerState(phoneNumber);
            expect(remaining).toBe(0);
        });

        it('should not affect other timers', () => {
            const phone1 = '0412345678';
            const phone2 = '0487654321';

            setTimerState(phone1, 60);
            setTimerState(phone2, 30);

            clearTimerState(phone1);

            expect(getTimerState(phone1)).toBe(0);
            expect(getTimerState(phone2)).toBeGreaterThan(28);
        });
    });

    describe('clearAllTimers', () => {
        it('should remove all OTP timers', () => {
            const phone1 = '0412345678';
            const phone2 = '0487654321';

            setTimerState(phone1, 60);
            setTimerState(phone2, 30);

            // Add some other localStorage item
            localStorage.setItem('other_key', 'some value');

            clearAllTimers();

            expect(getTimerState(phone1)).toBe(0);
            expect(getTimerState(phone2)).toBe(0);
            expect(localStorage.getItem('other_key')).toBe('some value');
        });
    });

    describe('error handling', () => {
        it('should handle corrupted localStorage data gracefully', () => {
            const phoneNumber = '0412345678';
            localStorage.setItem(`otp_timer_${phoneNumber}`, 'invalid json');

            const remaining = getTimerState(phoneNumber);
            expect(remaining).toBe(0);
        });
    });
});
