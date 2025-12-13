/**
 * Utility functions for generating display names and initials from user objects.
 * Note: Phone numbers are NOT used for display to protect user privacy.
 */

export interface UserDisplayInfo {
    name?: string | null;
    email?: string | null;
    phone?: string | null; // Optional - only if user manually adds it
}

/**
 * Gets a display-friendly name from a user object.
 * Priority: name > email prefix > "User"
 * Names are truncated to 15 characters max for UI consistency.
 */
export function getDisplayName(user: UserDisplayInfo | null | undefined): string {
    if (!user) return "User";

    let displayName = "User";
    if (user.name) {
        displayName = user.name;
    } else if (user.email) {
        displayName = user.email.split("@")[0];
    }

    // Truncate to max 15 characters to prevent UI breaking
    if (displayName.length > 15) {
        return displayName.substring(0, 15) + "…";
    }
    return displayName;
}

/**
 * Gets initials for avatar display.
 * Priority: first letter of name > first letter of email > "U"
 */
export function getInitials(user: UserDisplayInfo | null | undefined): string {
    if (!user) return "U";

    if (user.name) return user.name.charAt(0).toUpperCase();
    if (user.email) return user.email.charAt(0).toUpperCase();
    return "U";
}
