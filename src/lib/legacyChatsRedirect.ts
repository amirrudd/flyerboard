/**
 * Legacy chats-tab URL → dedicated /messages route mapping.
 *
 * `/dashboard?tab=chats` → `/messages`; `?tab=chats&chat=X` → `/messages/X`;
 * a `flyer` param is carried through as `?flyer=`. Returns null when the URL
 * is not a legacy chats-tab link.
 *
 * Consumed by the redirect shim in `src/pages/DashboardPage.tsx`. Kept
 * forever so in-flight notification emails and stale pushes that still point
 * at `?tab=chats` keep working.
 */
export function getLegacyChatsRedirect(search: string): string | null {
    const params = new URLSearchParams(search);
    // The archived tab was a real dashboard destination until the /messages
    // redesign — old bookmarks land on the archived sub-view.
    if (params.get("tab") === "archived") return "/messages/archived";
    if (params.get("tab") !== "chats") return null;
    const chat = params.get("chat");
    const flyer = params.get("flyer");
    const path = chat ? `/messages/${encodeURIComponent(chat)}` : "/messages";
    return flyer ? `${path}?flyer=${encodeURIComponent(flyer)}` : path;
}
