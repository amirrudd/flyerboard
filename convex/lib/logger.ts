/**
 * Centralized logging utility for Convex backend
 * Provides structured error creation and consistent logging patterns
 */

/**
 * Check if running in development environment
 */
export function isDevelopment(): boolean {
    // Convex Cloud URLs contain "convex.cloud"
    // Local development uses different URLs
    return process.env.CONVEX_CLOUD_URL?.includes("convex.cloud") === false;
}

/**
 * Context object for logging
 */
export interface LogContext {
    [key: string]: string | number | boolean | null | undefined;
}

/**
 * Create an error with embedded context for better debugging
 * Context will be included in the error message for Convex logs
 */
export function createError(message: string, context?: LogContext): Error {
    if (!context || Object.keys(context).length === 0) {
        return new Error(message);
    }

    // Format context as key=value pairs
    const contextStr = Object.entries(context)
        .filter(([_, value]) => value !== undefined && value !== null)
        .map(([key, value]) => `${key}=${value}`)
        .join(", ");

    return new Error(`${message} [${contextStr}]`);
}

/**
 * Log a successful operation (development only)
 * In production, only errors are logged by Convex
 */
export function logOperation(operation: string, details?: LogContext): void {
    if (!isDevelopment()) {
        return;
    }

    const detailsStr = details
        ? " " + Object.entries(details)
            .filter(([_, value]) => value !== undefined && value !== null)
            .map(([key, value]) => `${key}=${value}`)
            .join(", ")
        : "";

    console.log(`✓ ${operation}${detailsStr}`);
}

/**
 * Log a warning with context (development only)
 */
export function logWarning(message: string, context?: LogContext): void {
    if (!isDevelopment()) {
        return;
    }

    const contextStr = context
        ? " [" + Object.entries(context)
            .filter(([_, value]) => value !== undefined && value !== null)
            .map(([key, value]) => `${key}=${value}`)
            .join(", ") + "]"
        : "";

    console.warn(`⚠ ${message}${contextStr}`);
}

/**
 * Log an admin action (always logged, even in production)
 * Admin actions are critical and should always be tracked
 */
export function logAdminAction(action: string, context: LogContext): void {
    const contextStr = Object.entries(context)
        .filter(([_, value]) => value !== undefined && value !== null)
        .map(([key, value]) => `${key}=${value}`)
        .join(", ");

    console.log(`[ADMIN] ${action} [${contextStr}]`);
}
