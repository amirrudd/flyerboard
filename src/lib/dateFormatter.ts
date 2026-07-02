/**
 * Formats a date for display using the visitor's own browser locale
 * (e.g. dd/mm/yyyy for en-AU, mm/dd/yyyy for en-US) rather than a
 * hardcoded locale, so each visitor sees dates in their own convention.
 * @param date - A Date, or a timestamp/date-string accepted by `new Date()`
 */
export function formatDate(date: Date | number | string): string {
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleDateString();
}

/**
 * Formats a date and time for display using the visitor's own browser locale.
 * @param date - A Date, or a timestamp/date-string accepted by `new Date()`
 */
export function formatDateTime(date: Date | number | string): string {
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleString();
}
