/**
 * Formats a date for display using Australian locale conventions (dd/mm/yyyy).
 * @param date - A Date, or a timestamp/date-string accepted by `new Date()`
 * @returns Formatted date string, e.g. "2/07/2026"
 */
export function formatDate(date: Date | number | string): string {
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleDateString("en-AU");
}

/**
 * Formats a date and time for display using Australian locale conventions.
 * @param date - A Date, or a timestamp/date-string accepted by `new Date()`
 * @returns Formatted date-time string, e.g. "2/07/2026, 8:26 pm"
 */
export function formatDateTime(date: Date | number | string): string {
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleString("en-AU");
}
