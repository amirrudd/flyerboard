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
 */
export function getDisplayName(user: UserDisplayInfo | null | undefined): string {
    if (!user) return "User";

    if (user.name) return user.name;
    if (user.email) return user.email.split("@")[0];
    return "User";
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
