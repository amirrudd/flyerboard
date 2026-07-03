import { test, expect } from '@playwright/test';

/**
 * Regression guard for the full-screen wizard scroll bug (BundleFlow / MovingSaleFlow).
 *
 * The app deliberately locks body scroll at <=768px (src/index.css:
 * `@media (max-width:768px){ html,body{ overflow:hidden } }`) so only "designated
 * containers" scroll. A `/sell/*` flow that renders `min-h-[100dvh]` content in normal
 * document flow therefore relies on *body* scroll — which is disabled — leaving its
 * primary CTA below the fold and UNREACHABLE on a narrow viewport. The fix is a
 * fixed-height flex column whose step content lives in a `.mobile-scroll-container`.
 *
 * A fully authenticated run of `/sell/bundle` would need Descope auth fixtures plus a
 * seeded eligible-ad user, which the e2e harness doesn't have yet. Until that exists,
 * this reproduces the wizard's exact layout contract with the app's real stylesheet and
 * proves the mechanism: body scroll is locked, yet the bottom CTA is still reachable
 * because the designated container scrolls.
 */
test('mobile - full-screen wizard CTA stays reachable inside its scroll container', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'Mobile viewport only (Pixel 5 project is <768px wide)');

  // Load the app so its real compiled stylesheet (index.css + Tailwind JIT) is present.
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Reproduce the wizard shell using the SAME utility classes BundleFlow/MovingSaleFlow
  // use: fixed-height flex column, shrink-0 header, and a flex-1 .mobile-scroll-container
  // holding tall content with the primary button at the very bottom.
  await page.evaluate(() => {
    document.body.innerHTML = `
      <div class="flex h-[100dvh] flex-col bg-background">
        <header class="shrink-0 border-b border-border px-3 py-3">chrome</header>
        <div id="scroller" class="mobile-scroll-container flex-1">
          <div class="mx-auto w-full max-w-md px-5 py-6">
            <div style="height: 1800px">tall step content</div>
            <button id="cta" type="button" class="w-full rounded-xl bg-blue-600 px-4 py-4 text-white">
              Create bundle
            </button>
          </div>
        </div>
      </div>`;
  });

  const scroller = page.locator('#scroller');
  const cta = page.locator('#cta');

  // Preconditions: the container genuinely overflows (otherwise reachability is trivial),
  // and the wizard shell doesn't force a horizontal scrollbar.
  const { overflowsVertically, bodyScrolls } = await page.evaluate(() => {
    const el = document.getElementById('scroller')!;
    // Body scroll must be locked at this width — attempting to scroll the window is a no-op.
    window.scrollTo(0, 5000);
    return {
      overflowsVertically: el.scrollHeight > el.clientHeight,
      bodyScrolls: window.scrollY,
    };
  });
  expect(overflowsVertically).toBe(true);
  expect(bodyScrolls).toBe(0); // body/window cannot scroll — proves the constraint

  // The CTA starts below the fold...
  await expect(cta).not.toBeInViewport();

  // ...and scrolling the DESIGNATED container (not the body) brings it into view.
  await scroller.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  await expect(cta).toBeInViewport();
});
