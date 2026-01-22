import { test, expect, devices } from '@playwright/test';

/**
 * Visual regression tests for critical page layouts.
 * These tests capture screenshots and compare against baselines
 * to detect unintended layout changes.
 * 
 * To update baselines after intentional changes:
 * npm run test:visual:update
 */

const PAGES = [
    { name: 'home', path: '/' },
    { name: 'post-ad', path: '/post' },
];

for (const page of PAGES) {
    test(`layout consistency - ${page.name}`, async ({ page: p }) => {
        await p.goto(page.path);
        await p.waitForLoadState('networkidle');

        // Wait for any lazy-loaded content
        await p.waitForTimeout(500);

        await expect(p).toHaveScreenshot(`${page.name}.png`, {
            fullPage: true,
            animations: 'disabled',
        });
    });
}

// Mobile-specific layout tests
// These will run on the 'Mobile Chrome' project defined in playwright.config.ts
test('mobile - categories sidebar full height and scrollable', async ({ page, isMobile }) => {
    // Only run on mobile viewports
    test.skip(!isMobile, 'Desktop only');

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Open categories sidebar - using title attribute
    await page.click('button[title="Open menu"]');
    await page.waitForTimeout(300); // Wait for sidebar animation

    // Take screenshot of sidebar
    await expect(page).toHaveScreenshot('mobile-sidebar-open.png', {
        fullPage: true,
        animations: 'disabled',
    });

    // Verify sidebar is scrollable by checking if bottom categories are accessible
    const lastCategory = page.locator('text=Hobbies & Collectibles').last();
    await expect(lastCategory).toBeVisible();
});

test('mobile - PWA layout no header overlap', async ({ page, isMobile }) => {
    // Only run on mobile viewports
    test.skip(!isMobile, 'Desktop only');

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Take screenshot to verify no status bar overlap
    await expect(page).toHaveScreenshot('mobile-home.png', {
        fullPage: true,
        animations: 'disabled',
    });
});

// Dashboard requires authentication - skip for now
// Can be added later with proper test fixtures
