/**
 * Production-safe logging utility
 * Only logs debug information in development mode
 */

const isDevelopment = import.meta.env.DEV;

/**
 * Log debug information (only in development)
 */
export function logDebug(message: string, data?: any) {
    if (isDevelopment) {
        console.log(`[DEBUG] ${message}`, data !== undefined ? data : '');
    }
}

/**
 * Log errors (sanitized for production)
 * In production, logs only the error message without sensitive details
 */
export function logError(message: string, error?: any) {
    if (isDevelopment) {
        console.error(`[ERROR] ${message}`, error);
    } else {
        // In production, log only the message without potentially sensitive error details
        console.error(`[ERROR] ${message}`);
    }
}

/**
 * Log warnings
 */
export function logWarning(message: string, data?: any) {
    if (isDevelopment) {
        console.warn(`[WARN] ${message}`, data !== undefined ? data : '');
    }
}

/**
 * Log info (always logged, but sanitized)
 */
export function logInfo(message: string) {
    console.log(`[INFO] ${message}`);
}
