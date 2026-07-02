// FlyerBoard is an Australia-focused marketplace, so dates are always shown in
// Australian format (dd/mm/yyyy) regardless of the visitor's browser locale.
// (A bare toLocaleDateString() would follow navigator.language, so a visitor
// whose browser is set to en-US — very common even for AU-based users — would
// otherwise see mm/dd/yyyy. Hardcoding "en-AU" keeps the whole site consistent.)
const LOCALE = "en-AU";

/**
 * Formats a date for display in Australian format (dd/mm/yyyy).
 * @param date - A Date, or a timestamp/date-string accepted by `new Date()`
 */
export function formatDate(date: Date | number | string): string {
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleDateString(LOCALE);
}

/**
 * Formats a date and time for display in Australian format.
 * @param date - A Date, or a timestamp/date-string accepted by `new Date()`
 */
export function formatDateTime(date: Date | number | string): string {
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleString(LOCALE);
}
