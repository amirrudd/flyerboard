import { test, expect, Page } from '@playwright/test';

/**
 * Visual regression tests for critical page layouts.
 *
 * DATA-INDEPENDENCE: the home feed renders live Convex data (listings, view
 * counts, "N listings" header), so full-page screenshots of it broke whenever
 * anyone posted an ad or a view count ticked over. To keep snapshots
 * deterministic we:
 *   1. MASK the dynamic regions — the ads grid ([data-testid="ads-grid"]) and
 *      the pagination status block ([data-testid="feed-status"]) — so only
 *      stable chrome (header, sidebar, filter bar, bottom nav) is compared.
 *   2. Snapshot the VIEWPORT, not the full page. Full-page height varies with
 *      feed length, which fails the comparison on image dimensions before
 *      masking can help.
 *
 * If you add a new element that renders live backend data on these pages, give
 * it a data-testid and add it to DYNAMIC_REGIONS below.
 *
 * To update baselines after intentional changes:
 * npm run test:visual:update
 */

const DYNAMIC_REGIONS = ['[data-testid="ads-grid"]', '[data-testid="feed-status"]'];

function dynamicRegionMask(page: Page) {
    return DYNAMIC_REGIONS.map((selector) => page.locator(selector));
}

async function gotoHome(page: Page) {
    await page.goto('/');
    // Hide scrollbars: the thumb's size/position tracks feed length (live
    // data), so it leaks nondeterminism into otherwise-masked screenshots.
    await page.addStyleTag({
        content: '*::-webkit-scrollbar { display: none !important; } * { scrollbar-width: none !important; }',
    });
    await page.waitForLoadState('networkidle');
    // The grid section renders immediately (skeleton or cards) — wait for it so
    // the mask has a target, then let lazy content/fonts settle.
    await page.waitForSelector('[data-testid="ads-grid"]');
    await page.waitForTimeout(500);
}

// Convex data arrives over WebSocket, which 'networkidle' does NOT cover — the
// category list can render empty for a beat. Wait for a known seed category so
// the (unmasked) sidebar/drawer is in its loaded state before screenshotting.
async function waitForCategories(page: Page) {
    await expect(page.getByRole('button', { name: 'Vehicles' }).last()).toBeVisible();
}

test('layout consistency - home', async ({ page, isMobile }) => {
    await gotoHome(page);
    if (!isMobile) await waitForCategories(page); // desktop sidebar is always rendered

    await expect(page).toHaveScreenshot('home.png', {
        animations: 'disabled',
        mask: dynamicRegionMask(page),
    });
});

// /post requires auth; unauthenticated visitors are bounced to the home page.
// A real post-ad snapshot needs an authenticated storageState fixture — see
// e2e/README.md. Until then we lock in the redirect behavior instead.
test('post-ad redirects unauthenticated users home', async ({ page }) => {
    await page.goto('/post');
    await page.waitForURL('/');
    await expect(page.locator('[data-testid="ads-grid"]')).toBeVisible();
});

// Mobile-specific layout tests
// These will run on the 'Mobile Chrome' project defined in playwright.config.ts
test('mobile - categories sidebar full height and scrollable', async ({ page, isMobile }) => {
    // Only run on mobile viewports
    test.skip(!isMobile, 'Mobile only');

    await gotoHome(page);

    // Open categories sidebar - using title attribute
    await page.click('button[title="Open menu"]');
    await page.waitForTimeout(300); // Wait for sidebar animation
    await waitForCategories(page);

    // Verify sidebar is scrollable by checking if bottom categories are accessible
    const lastCategory = page.locator('text=Hobbies & Collectibles').last();
    await expect(lastCategory).toBeVisible();

    // Take screenshot of sidebar; the feed is still (partially) visible behind
    // the drawer, so it stays masked.
    await expect(page).toHaveScreenshot('mobile-sidebar-open.png', {
        animations: 'disabled',
        mask: dynamicRegionMask(page),
    });
});

test('mobile - PWA layout no header overlap', async ({ page, isMobile }) => {
    // Only run on mobile viewports
    test.skip(!isMobile, 'Mobile only');

    await gotoHome(page);

    // Take screenshot to verify no status bar overlap
    await expect(page).toHaveScreenshot('mobile-home.png', {
        animations: 'disabled',
        mask: dynamicRegionMask(page),
    });
});

// Dashboard/messaging flows require an authenticated storageState fixture —
// none exists yet. See e2e/README.md for the plan.
