/**
 * OTP Timer Storage Utilities
 * 
 * Manages persistent timer state in localStorage, keyed by phone number.
 * This ensures the 60-second timer persists across page refreshes and navigation.
 */

const STORAGE_KEY_PREFIX = 'otp_timer_';

export interface TimerState {
    phoneNumber: string;
    expiresAt: number; // Unix timestamp in milliseconds
}

/**
 * Get the remaining time (in seconds) for a phone number's OTP timer
 * Returns 0 if timer has expired or doesn't exist
 */
export function getTimerState(phoneNumber: string): number {
    try {
        const key = STORAGE_KEY_PREFIX + phoneNumber;
        const stored = localStorage.getItem(key);

        if (!stored) {
            return 0;
        }

        const state: TimerState = JSON.parse(stored);
        const now = Date.now();

        if (now >= state.expiresAt) {
            // Timer has expired, clean up
            clearTimerState(phoneNumber);
            return 0;
        }

        // Return remaining seconds
        return Math.ceil((state.expiresAt - now) / 1000);
    } catch (error) {
        console.error('Error reading timer state:', error);
        return 0;
    }
}

/**
 * Set a new timer for a phone number
 * @param phoneNumber - The phone number
 * @param durationSeconds - Timer duration in seconds (default: 60)
 */
export function setTimerState(phoneNumber: string, durationSeconds: number = 60): void {
    try {
        const key = STORAGE_KEY_PREFIX + phoneNumber;
        const expiresAt = Date.now() + (durationSeconds * 1000);

        const state: TimerState = {
            phoneNumber,
            expiresAt,
        };

        localStorage.setItem(key, JSON.stringify(state));
    } catch (error) {
        console.error('Error setting timer state:', error);
    }
}

/**
 * Clear the timer for a phone number
 */
export function clearTimerState(phoneNumber: string): void {
    try {
        const key = STORAGE_KEY_PREFIX + phoneNumber;
        localStorage.removeItem(key);
    } catch (error) {
        console.error('Error clearing timer state:', error);
    }
}

/**
 * Clear all OTP timers (useful for cleanup/testing)
 */
export function clearAllTimers(): void {
    try {
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
            if (key.startsWith(STORAGE_KEY_PREFIX)) {
                localStorage.removeItem(key);
            }
        });
    } catch (error) {
        console.error('Error clearing all timers:', error);
    }
}
