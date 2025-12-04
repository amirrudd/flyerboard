import { describe, it, expect } from 'vitest';
import { getDisplayName, getInitials } from './displayName';

describe('displayName utilities', () => {
    describe('getDisplayName', () => {
        it('should return name when available', () => {
            expect(getDisplayName({ name: 'John Doe' })).toBe('John Doe');
            expect(getDisplayName({ name: 'Jane', email: 'jane@example.com' })).toBe('Jane');
        });

        it('should return email prefix when name is not available', () => {
            expect(getDisplayName({ email: 'user@example.com' })).toBe('user');
            expect(getDisplayName({ email: 'john.doe@company.com' })).toBe('john.doe');
        });

        it('should return "User" when no name or email is available', () => {
            expect(getDisplayName({})).toBe('User');
            expect(getDisplayName(null)).toBe('User');
            expect(getDisplayName(undefined)).toBe('User');
            expect(getDisplayName({ phone: '+61412345678' })).toBe('User'); // Phone not used for privacy
        });

        it('should handle empty strings as unavailable', () => {
            expect(getDisplayName({ name: '', email: '' })).toBe('User');
            expect(getDisplayName({ name: '', email: 'user@example.com' })).toBe('user');
        });

        it('should handle null values', () => {
            expect(getDisplayName({ name: null, email: null })).toBe('User');
            expect(getDisplayName({ name: null, email: 'test@example.com' })).toBe('test');
        });
    });

    describe('getInitials', () => {
        it('should return first letter of name when available', () => {
            expect(getInitials({ name: 'John Doe' })).toBe('J');
            expect(getInitials({ name: 'alice' })).toBe('A');
        });

        it('should return first letter of email when name is not available', () => {
            expect(getInitials({ email: 'user@example.com' })).toBe('U');
            expect(getInitials({ email: 'bob@company.com' })).toBe('B');
        });

        it('should return "U" when no name or email is available', () => {
            expect(getInitials({})).toBe('U');
            expect(getInitials(null)).toBe('U');
            expect(getInitials(undefined)).toBe('U');
            expect(getInitials({ phone: '+61412345678' })).toBe('U'); // Phone not used for privacy
        });

        it('should handle empty strings as unavailable', () => {
            expect(getInitials({ name: '', email: '' })).toBe('U');
            expect(getInitials({ name: '', email: 'user@example.com' })).toBe('U');
        });

        it('should handle null values', () => {
            expect(getInitials({ name: null, email: null })).toBe('U');
            expect(getInitials({ name: null, email: 'test@example.com' })).toBe('T');
        });

        it('should uppercase lowercase letters', () => {
            expect(getInitials({ name: 'john' })).toBe('J');
            expect(getInitials({ email: 'alice@example.com' })).toBe('A');
        });
    });
});
