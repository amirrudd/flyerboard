import { test, expect } from '@playwright/test';

/**
 * Signed-out smoke coverage for the /messages routes (mobile chat redesign).
 *
 * SCOPE: the whole e2e suite runs unauthenticated — auth is Descope SMS OTP,
 * which cannot be automated here. So these tests cover exactly what is
 * deterministic without a session:
 *   1. /messages is auth-gated: signed-out visitors are bounced home.
 *   2. The legacy /dashboard?tab=chats&chat=X shim rewrites the URL to
 *      /messages/X (the redirect fires before/independently of the auth
 *      gate, so the rewrite itself is observable signed-out).
 *   3. The mobile BottomNav on the home page has a Messages destination.
 *
 * NOT covered (documented gap — needs an authed harness): inbox rendering,
 * opening a thread, composer/send, mark-as-read, archive, desktop two-pane.
 * No visual snapshots: every signed-out /messages state resolves to the home
 * page, which layout.spec.ts already snapshots.
 */

/** Wait until the SPA's current pathname matches. Catches transient
 *  replaceState hops (the shim redirect is immediately followed by the
 *  auth guard's redirect home for signed-out users). */
function waitForPath(page: import('@playwright/test').Page, path: string) {
    return page.waitForURL((url) => url.pathname === path, { timeout: 15_000 });
}

test('signed-out /messages redirects home', async ({ page }) => {
    await page.goto('/messages');
    await waitForPath(page, '/');
});

test('signed-out /messages/:chatId redirects home', async ({ page }) => {
    await page.goto('/messages/abc123');
    await waitForPath(page, '/');
});

test('legacy /dashboard?tab=chats&chat=X rewrites to /messages/X', async ({ page }) => {
    await page.goto('/dashboard?tab=chats&chat=abc123');
    // The DashboardPage shim rewrites the URL first; signed-out, the auth
    // guard then bounces to home. Assert the intermediate rewrite happened.
    await waitForPath(page, '/messages/abc123');
    // ...and that a signed-out visitor still ends up on the home page.
    await waitForPath(page, '/');
});

test('legacy /dashboard?tab=chats (no chat) rewrites to /messages', async ({ page }) => {
    await page.goto('/dashboard?tab=chats');
    await waitForPath(page, '/messages');
    await waitForPath(page, '/');
});

test('mobile BottomNav shows a Messages item on home', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'BottomNav is mobile-only chrome');
    await page.goto('/');
    await page.waitForSelector('[data-testid="ads-grid"]');
    await expect(page.getByRole('button', { name: 'Messages' })).toBeVisible();
});
