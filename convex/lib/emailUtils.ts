/**
 * Email validation and normalization utilities
 */

/**
 * Validates email format using a standard regex pattern
 * @param email - Email address to validate
 * @returns true if valid, false otherwise
 */
export function isValidEmail(email: string | undefined | null): boolean {
    if (!email || email.trim() === "") {
        return false;
    }

    // Standard email regex pattern
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Normalizes email to lowercase for consistent comparison
 * Returns null for empty/undefined emails
 * @param email - Email address to normalize
 * @returns Normalized email or null
 */
export function normalizeEmail(email: string | undefined | null): string | null {
    if (!email || email.trim() === "") {
        return null;
    }
    return email.toLowerCase().trim();
}
