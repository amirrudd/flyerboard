# E2E & visual regression tests (Playwright)

Run with `npm run test:visual`; update baselines with `npm run test:visual:update`.

## Prerequisites — the backend must be running

`playwright.config.ts` auto-starts the Vite frontend (port 5173) but **not** the
Convex backend. Start `npx convex dev` first (or have `npm run dev` running).
Without it the app renders empty states ("0 listings", no categories) and the
category-load waits in `layout.spec.ts` fail — that failure is intentional; it's
what stops you from baking an empty-backend state into a baseline.

Worktree note: copy `.env.local` from the main repo into the worktree or Vite
starts without a Convex URL.

## How the visual snapshots stay data-independent

The home feed renders live Convex data, so naive full-page screenshots broke
whenever a listing was added or a view count changed. `layout.spec.ts` keeps
baselines deterministic by construction:

1. **Dynamic regions are masked.** The ads grid (`[data-testid="ads-grid"]`)
   and the pagination status block (`[data-testid="feed-status"]`) are painted
   over with Playwright's `mask` option. Only stable chrome — header, sidebar,
   filter bar, bottom nav — is actually compared.
2. **Viewport screenshots, not `fullPage`.** Full-page height tracks feed
   length, which fails the comparison on image dimensions before masking can
   help.
3. **Waits are state-based, not time-based.** Convex data arrives over
   WebSocket, which `waitForLoadState('networkidle')` does not cover. Tests
   wait for a known seed category ("Vehicles") so the unmasked sidebar is in
   its loaded state.
4. **Scrollbars are hidden** via injected CSS — the thumb's size tracks feed
   length and leaks nondeterminism into the right edge of screenshots.

**If you add an element that renders live backend data to a snapshotted page,
give it a `data-testid` and add it to `DYNAMIC_REGIONS` in `layout.spec.ts`.**

Verify determinism after touching these tests: run `npm run test:visual` twice
(and ideally between two different data states — e.g.
`npx convex run seed:seedBundleAds '{"email": "...", "reset": true}'`).

Categories are treated as stable chrome: they're a fixed seeded list
(`convex/categories.ts` + the Hobbies migration), not user-generated data. If a
category is ever renamed, regenerate baselines.

**Known residual data-sensitivity (observed 2026-07-09, Boost Phase 6):** the
mask paints over the grid *element*, so the mask's own boundary still tracks
feed length — with a dataset much larger/smaller than the baseline's, unmasked
slivers at the grid's right/bottom edges shift and the Mobile Chrome snapshots
exceed `maxDiffPixels`. Desktop passed, mobile failed, purely from data volume
(e.g. after `sampleData:clearAndCreateSampleData`, which also *regenerates
categories* — violating the "categories are stable chrome" assumption above).
Run this suite against the standard dev dataset the baselines were captured
from; don't regenerate baselines from a synthetic dataset.

## Snapshot platforms

Baselines are per-platform (`-darwin`, `-linux`). Locally you generate darwin
ones; the `visual-tests.yml` workflow auto-generates and commits missing linux
baselines on the next PR run (Desktop Chrome project only in CI).

## Authenticated flows (dashboard, messaging, post-ad) — not yet covered

There is no auth fixture today. `/post` redirects unauthenticated visitors to
`/`, so `layout.spec.ts` asserts the redirect instead of snapshotting the form.

To make these flows testable, add a Playwright **storageState** fixture:

1. Create a dedicated Descope **test user** (Descope console → Users, or the
   management API with a management key). Descope test users support OTP
   retrieval via API, so login can be scripted without email access.
2. Add an `auth.setup.ts` "setup" project that performs the Descope login flow
   once, waits for the Convex user-sync to complete, and saves
   `page.context().storageState({ path: 'e2e/.auth/user.json' })`.
   Gate it on env vars (e.g. `E2E_DESCOPE_TEST_USER_ID`) and skip when absent;
   never commit real credentials or the `.auth/` directory.
3. Point authed test projects at that storageState via project `dependencies`
   (see Playwright's auth docs) and mask their dynamic regions the same way.

The dashboard's own listings/threads are live data too — any authed snapshot
needs the same mask-the-data, snapshot-the-chrome treatment as the home page.
