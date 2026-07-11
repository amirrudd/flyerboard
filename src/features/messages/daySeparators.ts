/**
 * Day-separator helpers for conversation threads.
 *
 * Pure functions (injectable `now`) so the "Today"/"Yesterday" boundaries are
 * unit-testable without faking timers. Rendering lives in ConversationThread —
 * this module only decides WHERE a separator goes and WHAT it says.
 * Date math via date-fns (already used by MessageBubble/InboxRow).
 */

import { differenceInCalendarDays, isSameDay } from "date-fns";

/** True when two timestamps fall on the same local calendar day. */
export function isSameLocalDay(a: number, b: number): boolean {
    return isSameDay(a, b);
}

/**
 * Human label for the day a message was sent: "Today", "Yesterday", or a
 * short date ("5 Jul", with the year appended once it differs from the
 * current year — "5 Jul 2025").
 */
export function getDaySeparatorLabel(
    timestamp: number,
    now: Date = new Date()
): string {
    const dayDiff = differenceInCalendarDays(now, timestamp);
    if (dayDiff === 0) return "Today";
    if (dayDiff === 1) return "Yesterday";
    const date = new Date(timestamp);
    const sameYear = date.getFullYear() === now.getFullYear();
    // Intl (not date-fns format) so the month abbreviation is locale-correct
    // for en-AU ("5 July" — its ICU "short" month is the full word).
    return date.toLocaleDateString("en-AU", {
        day: "numeric",
        month: "short",
        ...(sameYear ? {} : { year: "numeric" }),
    });
}
