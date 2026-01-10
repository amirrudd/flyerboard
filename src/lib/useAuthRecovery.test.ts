import { describe, it, expect } from 'vitest';
import { isAuthError } from './useAuthRecovery';

// Note: useAuthRecovery hook tests are limited since it relies on Descope SDK
// which requires complex mocking. We focus on testing the pure function.

describe('isAuthError', () => {
    it('returns true for "Not authenticated" error', () => {
        const error = new Error('Not authenticated');
        expect(isAuthError(error)).toBe(true);
    });

    it('returns true for "Unauthorized" error', () => {
        const error = new Error('Unauthorized access');
        expect(isAuthError(error)).toBe(true);
    });

    it('returns true for "401" error', () => {
        const error = new Error('Request failed with status code 401');
        expect(isAuthError(error)).toBe(true);
    });

    it('returns true for "Token expired" error', () => {
        const error = new Error('Token expired');
        expect(isAuthError(error)).toBe(true);
    });

    it('returns true for "Invalid token" error', () => {
        const error = new Error('Invalid token provided');
        expect(isAuthError(error)).toBe(true);
    });

    it('returns true for "Session expired" error', () => {
        const error = new Error('Session expired, please login again');
        expect(isAuthError(error)).toBe(true);
    });

    it('returns true for "Authentication failed" error', () => {
        const error = new Error('Authentication failed');
        expect(isAuthError(error)).toBe(true);
    });

    it('returns true for case-insensitive matching', () => {
        const error = new Error('NOT AUTHENTICATED');
        expect(isAuthError(error)).toBe(true);
    });

    it('returns false for network errors', () => {
        const error = new Error('Network request failed');
        expect(isAuthError(error)).toBe(false);
    });

    it('returns false for generic errors', () => {
        const error = new Error('Something went wrong');
        expect(isAuthError(error)).toBe(false);
    });

    it('returns false for null error', () => {
        expect(isAuthError(null)).toBe(false);
    });

    it('returns false for undefined error', () => {
        expect(isAuthError(undefined)).toBe(false);
    });

    it('returns false for error without message', () => {
        const error = new Error();
        expect(isAuthError(error)).toBe(false);
    });
});
