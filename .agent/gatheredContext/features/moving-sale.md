# Moving Sale Mode

**Last Updated**: 2026-07-05 (MovingSaleFlow chrome now uses shared `WizardShell`)

## Public sale page A/B test (2026-07-01)
Two designs of the buyer-facing `/sale/:slug` page now coexist, both theme-matched
(our CSS-var tokens, `dc3626` primary, Fraunces/Plus Jakarta Sans) but visually
distinct:
- **Variant A** — `PublicSaleView.tsx` (original card-based layout, unchanged).
- **Variant B** — `PublicSaleViewEditorial.tsx` (serif-led redesign adapted from a
  Claude Design mockup: big Fraunces headline, inverted dark countdown panel,
  "Most wanted" featured item, "Best value" bundle badge, suburb-pin location
  card, and a row of small logistics tag-chips near the bottom — "Cash or
  transfer" / "Bring a friend for big stuff" / "First in, best dressed"). Same
  props contract as Variant A plus optional `sellerImage`/`sellerVerified`.
- **Split mechanism**: `useSaleDesignVariant.ts` — no analytics/experimentation
  pipeline exists in this app (confirmed by search: `featureFlags` is boolean-only,
  no variant/rollout concept, no PostHog/GrowthBook/etc.), so this is a
  self-contained 50/50 localStorage-persisted coin flip per browser, with a
  `?variant=a|b` URL override (also persisted) for manual QA/demoing. Resolved
  once via `useState`'s lazy initializer, not an effect, to avoid re-rolling on
  re-render.
- **Not yet built**: any actual conversion tracking (message-click, share-click,
  etc.) tagged by variant — there's nowhere to send that data yet. If the A/B
  test needs to produce a real winner, that's a follow-up decision (what metric,
  where it's stored/viewed), not assumed here.
- **Config toggle (2026-07-01)**: `movingSaleDesignForceB` — a normal boolean
  row in the existing `featureFlags` table (no new infra; deliberately NOT
  Firebase — `getFeatureFlag` is a public, reactive Convex query, so toggling
  it from Admin > Feature Flags updates every open client instantly with no
  redeploy). When enabled, everyone gets Variant B, overriding the per-browser
  random split (but not the `?variant=` URL override, which still wins — see
  precedence in `PublicSalePage.tsx`: URL > force flag > sticky random pick).
  Bootstrapped locally via `seed:setFeatureFlagLocal` (`convex/seed.ts`) since
  the real `createFeatureFlag`/`updateFeatureFlag` mutations are admin-gated
  and no local admin user existed — flip it through the real Admin UI once one
  does; the dev helper writes the identical row shape.
- **Header/theme-toggle was missing (2026-07-01, fixed)**: `Header` (with
  `ThemeToggle`) is NOT rendered globally by `Layout.tsx` — despite importing
  it, `Layout` never puts `<Header>` in its JSX. Every page that wants a
  header renders its own `<Header>` instance (`HomePage`, `AdDetail`, `PostAd`,
  dashboards, static pages…). `PublicSalePage` never did, so visitors had no
  way to switch dark/light mode. Fixed by adding a minimal `<Header
  leftNode={back} centerNode={wordmark} rightNode={<ThemeToggle />} />`,
  mirroring `AdDetail`'s pattern exactly (when you supply `rightNode` yourself,
  you're responsible for including `ThemeToggle` — the default only renders if
  `rightNode` is omitted). **If a new page ever feels chrome-less, check for a
  missing `<Header>` first — it is not inherited.**
- **Save = bookmark whole Sale, not bulk-save items (2026-07-01)**: Added
  `savedSaleEvents` table + `saveSaleEvent`/`isSaleEventSaved`/
  `getSavedSaleEvents` in `convex/saleEvents.ts`, mirroring `savedAds`/
  `saveAd`/`isAdSaved` exactly. Rationale: a Sale is already a first-class
  entity (own detail page, own message thread — see the sale-level messaging
  section above), so bookmarking it should behave like bookmarking an ad, not
  fan out into saving its individual items. Shared save/animate/toast logic
  lives in `useSaveSaleEvent.ts` (used by both page variants) — mirrors
  `AdDetail.tsx`'s `handleSave`/`heartControls` pop-animation pattern exactly.
  Surfaced in `UserDashboard.tsx`'s "Saved" tab as a "Saved Sales" section
  above "Saved Ads" (only rendered when non-empty).
- **App-wide icon swap: Heart → BookmarkSimple for "save" (2026-07-01)**. The
  mockup used a bookmark icon for its save button; the app's prior convention
  was a Heart (favorite-style) icon. Decision: standardize on
  `BookmarkSimple` everywhere save-related, since "Saved"/"Bookmarks" is
  already the app's own language for this feature (dashboard tab literally
  says "Bookmarks" → "Saved Ads") — bookmark reads as "save for later",
  heart reads as "like", and the former matches. Changed in exactly 3 files
  (small, contained blast radius — checked via grep first): `BottomNav.tsx`
  (Saved tab icon), `AdDetail.tsx` (save button ×2), `UserDashboard.tsx`
  (Saved Flyers tab icon + empty-state icon). `Heart` remains used elsewhere
  for unrelated things (e.g. `categoryIcons.tsx`'s Hobbies category) — that's
  fine, only the *save-affordance* meaning changed.
- **Test gotcha**: `UserDashboard.test.tsx` mocks `useQuery` **positionally by
  call order**, not by which query function is called (`mockReturns.push(...)`
  / chained `.mockReturnValueOnce(...)` in the exact sequence the component's
  hooks fire). Adding a new `useQuery` call anywhere in `UserDashboard.tsx`
  shifts every subsequent mocked return by one slot and silently breaks
  unrelated tests. If you add a hook call there, grep the test file for
  `mockReturnValueOnce`/`mockReturns.push` and insert a matching entry at the
  same position in every sequence.
- `PublishStep.tsx`'s seller live-preview still only renders Variant A —
  intentional, it's a confirmation UI, not part of the buyer-facing test.
- `getSaleBySlug` (`convex/saleEvents.ts`) now also returns `seller.isVerified`
  (was previously omitted) so Variant B can show the same `/verified-badge.svg`
  used by `SellerProfile.tsx` elsewhere in the app.

## ⚠️ v3.1 update (2026-06-30) — feed items un-differentiated; richer ad-detail banner

- **Feed sale items now look EXACTLY like single listings** — no badge, no strip, no
  "In a moving sale" footer. (The "In a moving sale ›" footer from earlier today was
  removed: the `›` chevron read as the primary CTA → nested-tap-target confusion.) The
  only feed differentiator is the whole-Sale 2×2 card. `AdsGrid` lost its `saleSummaries`
  prop + the per-item footer branch; `HomePage` dropped the `getSaleSummaries` wiring (kept
  the max-3-per-Sale `displayAds` de-dup + the `saleCards`).
- **`getSaleSummaries` was replaced by `getSaleBannerForAd(adId)`** — returns null unless the
  ad is in a published Sale; provides the seller's **title-cased** first name, suburb, item
  count, pickup start, min price, the current item image, up to 3 other item images, and a
  `moreCount`. (`getSaleBannerForAd` is the only consumer now; feed badges are gone.)
- **Batch-review Edit sheet works on desktop now**: the shared `BottomSheet` is `lg:hidden`
  by default (mobile-only); it gained an opt-in `showOnDesktop` prop (centres + width-caps the
  panel via `mx-auto max-w-md`, keeping the slide-up animation). `ReviewStep` passes it so
  desktop sellers can edit title/condition/category, not just the inline price stepper.
- **Ad-detail banner redesigned** (`AdDetail.tsx`): house-circle + "Part of {Name}'s Moving
  Sale" + sub-line "suburb · N items · pickup · from $X", plus a thumbnail strip (current
  item dimmed with a primary ring + up to 3 others + "+N"). Whole banner taps to the Sale.
  Sold-item copy: "This item has sold · N items still available". Discovery happens HERE now,
  not in the feed.

---


## ⚠️ v3 update (2026-06-30) — feed model finalised

The "Sale event card pinned above the feed" from v2 is **removed**. A Sale now renders as
**one card inside the regular date-sorted `AdsGrid`**, same shell as an ad card, slotted at
its own `createdAt` position (sort rule unchanged — sale cards just interleave by date).
- `AdsGrid` takes an optional `saleCards?: SaleFeedCard[]` prop (+ `onSaleClick`), merges
  ads (`_creationTime`) and sale cards (`createdAt`) into one date-sorted list, and renders a
  sale branch reusing the exact `motion.article` shell. Default-empty prop = zero regression.
- New `src/features/movingSale/SaleThumbnail.tsx` = the 2×2 image-grid **degradation ladder**
  (4+ → 3 covers + "+N" overlay · 3 → 2×2 with house-placeholder cell · 2 → strips · 1 →
  single · 0 → house+suburb). Red "Moving Sale" badge, "from $X" price, "N items" footer.
- Sale feed cards (`feed.getFeed`, kind `"sale"`; formerly `getActiveSales`, deleted 2026-07-17) carry `{ slug,title,suburb,createdAt,itemCount,photoCount,minPrice,covers }`
  (newest-first; pinned-first dropped). `HomePage` passes it as `saleCards` (gated to the
  uncategorised feed). The old `SaleEventCard.tsx` + its test are deleted.
- Built per the **design skill** (redesign-preserve): match existing tokens/shell, no em-dashes.
- **Bundle Listing** (the other v3 section) is deferred — a separate feature for a later session.
- Tests run convex files via `convex-test`; they use Vite's `import.meta.glob`, so each convex
  test file needs `/// <reference types="vite/client" />` for `tsc -p convex` (do NOT exclude
  test files from `convex/tsconfig.json` — that breaks ESLint's typed parser).

---


## ⚠️ v2 update (2026-06-30) — READ FIRST, supersedes parts below

The design doc was revised (`ResearchLab/ideas/moving-sale-mode-design.md`, v2). Key changes
now reflected in the code:

- **The mode is FREE — no paywall.** The $9 publish gate is gone. `publishSaleEvent`
  publishes for free (mints slug, status `active`, activates items). `getSaleBySlug` gates on
  `status !== "draft"`, NOT `isPaid`. The item cap is removed (`addSaleItems` only enforces a
  100-item abuse ceiling). `PaywallStep` was replaced by `PublishStep` (free, un-blurred preview).
- **Monetisation = à-la-carte add-ons**, offered on the share screen, never as a blocker:
  `purchaseAddon(saleEventId, "flyer"|"pin"|"ai")` (STUB — flips `unlockedAddons` / `pinnedUntil`;
  real flow opens Stripe per add-on). `ShareStep` gates QR+PDF behind the `flyer` add-on; the
  7-day `pin` and `ai` are stub/coming-soon. `saleEvents` gained `unlockedAddons[]`, `pinnedUntil`;
  `isPaid`/`itemCap` are now optional legacy fields (kept for back-compat, not enforced).
- **Sale-level messaging is real now** (replaces the old "Message → route to /ad/:id" shortcut):
  `convex/saleChats.ts` → `sendSaleMessage` / `getSaleThread`. One thread per buyer per Sale
  (`chats.saleEventId` + index `by_sale_event_buyer`; `chats.adId` is now **optional**), items as
  chips (`messages.referencedAdIds`). Frontend: `SaleMessageModal` on the public page (signed-out
  users are routed to Layout's `SmsOtpSignIn` via outlet context — the local `AuthModal` was a dead
  convex-auth password form, removed 2026-07-12; see features/authentication.md). **Gotcha:** making `chats.adId` optional broke 6 call
  sites that assumed it (adDetail/admin/messages) — all now guard `if (chat.adId)`; item-chat push/
  email notifications only fire when `adId` is set (sale-thread notifications not wired yet).
  `getSellerChats`/`getBuyerChats` now also return `sale`; the dashboard chats tab shows a 🏠 title
  and keeps the reply box enabled for sale threads.
- **Feed integration:** sale items get a badge + tappable strip in `AdsGrid` (driven by an optional
  `saleSummaries` prop + `onSaleClick` — default empty = no regression elsewhere); `HomePage` builds
  the summary map (`getSaleSummaries`), de-dups to **max 3 items per Sale**, and renders distinct
  `SaleEventCard`s (`getActiveSales`, pinned-first) above the grid. `AdDetail` shows a sale-context
  banner when `ad.saleEventId` is set.
- **Entry point #1 shipped:** PostAd top-of-form **mode selector** ("Single item" default vs
  "Moving Sale · Free" → `/sell/moving-sale`), new posts only, zero regression. Header split-button
  and FAB long-press (#2/#3) are still deferred.

Everything below predates v2 — treat the v2 notes above as authoritative where they conflict
(esp. anything about the $9 paywall, `isPaid` gating, item caps, or routing messages to `/ad/:id`).

---


Multi-item "run a moving sale" flow: a seller bulk-uploads photos, reviews
AI-drafted listings card-by-card, optionally bundles them, previews a public sale
page, pays (stubbed), and shares it (link / QR / printable flyer). Spec lives in
`ResearchLab/ideas/moving-sale-mode-design.md` (separate worktree).

## Status of the two external dependencies (READ THIS FIRST)

This was built **core-first with AI and payment stubbed behind clean seams** (a
deliberate scoping decision — neither external account/key existed). Both are
designed to drop in later without reworking the flow:

- **AI photo-to-listing — STUBBED.** There is no LLM/vision call. `addSaleItems`
  creates drafts with placeholder titles ("Item 3"), no price, and a default
  category. The "AI confidence" badge in batch review is **derived from draft
  completeness** in `saleHelpers.ts#itemConfidence` (real title+price → high,
  one → medium, neither → low). When wiring real vision: call it in/after
  `UploadStep`, populate title/category/condition/price + a real confidence, and
  replace `itemConfidence`. The whole batch-review UX already works against this
  shape.
- **$9 paywall — STUBBED.** `saleEvents.publishSaleEvent` IS the seam. It
  currently runs directly (owner calls it → sale goes live). Real flow: open
  Stripe Checkout from `PaywallStep`, move the publish body into an
  `internalMutation` called only from a verified `checkout.session.completed`
  webhook. The slug is minted here and must stay permanent (printed flyers encode
  it). `isPaid` on `saleEvents` gates the public page.

## Data model (`convex/schema.ts`)

- **`saleEvents`** — first-class entity (NOT a flag on ads). Fields: `userId`,
  `slug?` (minted at publish, permanent), `title`, `suburb`, `note?`,
  `pickupWindowStart/End`, `status` (`draft`|`active`|`ended`), `itemCap`
  (10 free / 25 paid), `isPaid`, `flyerPdfUrl?`, `expiresAt?`, `createdAt`.
  Indexes: `by_user`, `by_slug`, `by_status`.
- **`saleBundles`** — `saleEventId`, `label`, `bundlePrice`, `adIds[]`. Index
  `by_sale_event`.
- **`ads` additions** — `saleEventId?`, `isSold?`, `bundleId?`, `condition?`,
  plus index `by_sale_event`.

### Load-bearing schema decisions
- **Sold items use `isSold`, NOT `isDeleted`.** They must stay visible (greyed)
  on the sale page or a half-sold sale looks dead. Soft-delete still applies for
  *removing* an item from the sale (`removeSaleItem` sets `isDeleted`).
- Sale items are created with **`isActive: false`** (draft) and flipped to
  `true` on publish, so they don't leak into the main feed before payment. After
  publish they DO appear in the main feed (intended — "featured in feed").
- Slug format `{first}-sale-{suburb}-{4char}`, collision-checked via `by_slug`.

## Backend (`convex/saleEvents.ts`)
All mutations: `getDescopeUserId` + ownership check (`requireOwnedSale` helper).
- `createSaleEvent`, `updateSaleEvent`, `addSaleItems` (enforces `itemCap`,
  default category via `getDefaultCategoryId`), `updateSaleItem`, `removeSaleItem`,
  `setItemSold`, `setBundles` (replaces all bundles + restamps `ads.bundleId`),
  `publishSaleEvent` (STUB paywall).
- Queries: `getMySaleEvents` (dashboard, with stats), `getSaleEditor` (owner-only
  editor/preview payload), `getSaleBySlug` (**public, no auth; returns null unless
  `isPaid`**).
- Rate limits added in `convex/lib/rateLimit.ts`: `createSaleEvent` (5/day),
  `addSaleItems` (60/hr).

## Frontend (`src/features/movingSale/`)
- `MovingSaleFlow.tsx` — orchestrator state machine (intro→setup→upload→review→
  bundles→paywall→share). Drives everything off `getSaleEditor` (reactive). The
  full-screen chrome (fixed-height column + back/progress/exit header + internal
  `.mobile-scroll-container`) is the shared `src/components/WizardShell.tsx` (extracted
  2026-07-05, also used by `BundleFlow`). `intro`/`share` pass `showHeader={false}` to
  render full-bleed; see the WizardShell + scroll-container notes in `bundles.md`.
- `steps/` — `SetupStep` (pickup presets, not raw timestamps), `UploadStep`
  (bulk upload → R2 → `addSaleItems`), `ReviewStep` (card-by-card, confidence
  badge, progress chips, inline price stepper, `BottomSheet` edit, "Later" skip),
  `BundlesStep` (category-based suggestions + custom builder), `PaywallStep`
  (blurred `PublicSaleView` preview + publish), `ShareStep` (QR + channel copy +
  print flyer).
- `PublicSaleView.tsx` — shared buyer-page layout, reused by the paywall preview
  (`preview` prop = blur + "Preview only") AND the public page.
- `QrCode.tsx` — client-side QR via `qrcode` npm pkg (added to deps). No server.
- Pages: `src/pages/MovingSalePage.tsx` (auth-gated, route `/sell/moving-sale`,
  **outside `Layout`** for full-screen immersion; `?sale=<id>` resumes a draft),
  `src/pages/PublicSalePage.tsx` (route `/sale/:slug`, **inside `Layout`**, public).
- Dashboard: `src/features/dashboard/MovingSalesTab.tsx` ("Moving sales" tab) plus
  an always-visible entry banner in the "My Flyers" section (the desktop sidebar
  tab isn't reachable from the mobile bottom-nav, so the banner covers mobile).

### Reuse / conventions followed
- Images via `<ImageDisplay imageRef=...>` (resolves R2 keys). Upload via
  `generateListingUploadUrl({ postId: saleEventId })` + `uploadImageToR2` — the
  action accepts any path segment as `postId`, so images group under
  `flyers/{saleEventId}/`.
- **"Message {seller}" CTA routes to an available item's `/ad/:id`** rather than a
  new sale-level chat — reuses the existing chat + Descope OTP auth flow. KNOWN
  SIMPLIFICATION vs. the spec's single sale-level thread (would need a
  `saleEventId` on `chats`). Per-item tap also goes to `/ad/:id`.
- PDF flyer = `ShareStep.buildFlyerHtml` opened in a new window → browser
  print-to-PDF (self-contained HTML + inlined QR data URL). Deliberately avoids
  jsPDF/Puppeteer. The spec's server-side Puppeteer + cached `flyerPdfUrl` is the
  future upgrade; the `flyerPdfUrl` column already exists.

## Sample data (seed)
`convex/seed.ts` → `seedMovingSale` (internalMutation) creates a fully published
sample sale (8 items, 1 marked sold, 2 bundles, Unsplash image URLs, pickup =
next Saturday) owned by a given email. Run against the deployment that has your
login:
```
npx convex run seed:seedMovingSale '{"email":"you@example.com"}'
# add "reset": true to clear this user's prior demo sales first
```
It prints the slug — open `/sale/<slug>`. Uses external image URLs so no R2 upload
is needed (`getImageUrl` returns http refs as-is).

`seedMovingSale` never clears anything unless you pass `{"reset": true}`, and
even then it only clears *that same resolved user's* prior `-demo-` sales — it
happily piles up a new sale event + 8 duplicate items every time you re-run it
without `reset`. If you've run it repeatedly across a long session, use the
sibling `seed:wipeSeededMovingSales` (added 2026-07-01) to wipe every seeded sale
event/item/bundle plus placeholder `seed|...` users in one shot before reseeding
— it correctly skips any real Descope-synced user (no `seed|` token prefix).

**This worktree's local Convex data lives in the worktree's own
`.convex/local/default/convex_local_backend.sqlite3`** — a separate file from
the main checkout's `~/.convex/anonymous-convex-backend-state/anonymous-FlyerBoard/`
database. Symptom of running dev from the wrong directory: `npm run dev` from
the main repo binds to the main repo's ports (3210/3211) and its own dataset;
from a worktree it binds to the worktree's ports (3212/3213 here) and a
*completely separate* dataset. If you `cd` to the wrong directory before
`npm run dev`, you'll be looking at a different local database with different
seed history — items "disappearing"/duplicating is almost always this, not
data loss. Always confirm with `lsof -p <convex-dev-pid> | awk '$4=="cwd"'`
before assuming data was deleted.

The worktree's database also never gets the general marketplace sample data
(`convex/sampleData.ts` → `sampleData:clearAndCreateSampleData`, e.g. the
"2020 Toyota Camry Hybrid" listing) unless you run it explicitly — it isn't
seeded automatically just because Moving Sale data exists. Note this mutation
**deletes all existing ads and categories** before recreating its 5 sample
users' listings, so run it *before* `seedMovingSale`, not after.

## Gotchas hit during the build
- **Lint forbids BOTH `set-state-in-effect` AND `refs-during-render`** (custom
  react-hooks rules, error-level). To "adjust state when async data loads"
  (resume-step in `MovingSaleFlow`, item-sync in `ReviewStep`) use the
  **setState-during-render guarded by a state flag** pattern (React's official
  "adjust state when inputs change"), not an effect and not a ref. `ReviewStep`
  avoids the sync entirely by deriving the active item from `items` + a `decided`
  map instead of an `order` array.
- **`onClick={asyncFn}` fails `no-misused-promises`.** Wrap every async/Promise-
  returning handler (incl. RR v7 `navigate(...)`, which returns a Promise):
  `onClick={() => { void fn(); }}`.
- **Worktree env for codegen:** the worktree had an empty `node_modules` and no
  `.env.local`; `convex dev --once` spun up a *local anonymous* deployment that
  needs `CONVEX_AUTH_ISSUER` + `DESCOPE_PROJECT_ID` set (`npx convex env set ...`,
  dummy values) before codegen/push succeeds. Local-only, no shared impact.
- **Variant B (2026-07-01) fixes, ported straight from the original Claude
  Design mockup that hadn't made it into the first pass**:
  - The rotated "MOVING SALE {SUBURB}" corner stamp on the hero was simply
    missed during the initial port (not a deliberate cut) — re-added, themed
    with `border-primary`/`text-primary`/`bg-card` instead of the mockup's
    hardcoded hex.
  - The sticky category-filter bar used `sticky top-0`, which put it at the
    *exact same* scroll position as the app's own `<Header>` (also `sticky
    top-0`, `z-50` — see the "Header was missing" note above). Since both
    share `top-0`, the lower z-index pill bar renders fully hidden behind the
    header once stuck, instead of appearing broken/absent. First tried `sticky
    top-21` (an existing token — `5.0625rem` = 57px header + 24px gap, used by
    `AdDetail`'s desktop **sidebar**) — that resolved the overlap but left a
    visible 24px dead strip of bare background between header and pills once
    stuck, which read as a rendering bug rather than intentional breathing
    room. `top-21`'s 24px buffer suits a sidebar card sitting apart from the
    header; a horizontal filter/tab bar should feel *docked* to the header
    instead. Landed on `sticky top-[57px]` (Header's literal `h-[57px]`) for
    zero gap — pills sit flush under the header like a tab strip, still with
    no overlap since it no longer shares `top-0` with the header. **For a
    sticky element that should dock directly under `<Header>` with no visible
    seam, match the header's exact height, not `top-21` — that token is for
    sidebar-style content that wants breathing room, not tab bars.**
  - Item images (featured + grid) now use `ImageDisplay`'s `backdrop` prop —
    the same blurred-backdrop fill `AdsGrid` uses on the home feed. `PublicSaleView`
    (Variant A) already had this; Editorial didn't. Bundle thumbnails
    intentionally still use plain `object-cover` in both variants (too small at
    46px for the effect to read, and A doesn't do it there either).
  - Share button had no animation in either variant (Save already mirrors
    `AdDetail`'s `heartControls` pop; Share didn't have its `shareControls`
    counterpart). Added `useAnimation()` + `scale: [1, 1.18, 0.96, 1]` pop on
    click to both, matching `AdDetail.handleShare` exactly.

## Feature flag: `movingSaleMode` (2026-07-01)
Whole-feature kill switch, seeded via `migrations:seedFeatureFlags` (`enabled:
true` by default — this gates the already-shipped feature going forward, it's
not a dark launch). Managed from Admin > Feature Flags like any other flag
(`getAllFeatureFlags` lists it automatically, no special-casing needed there).
New shared hook: `useFeatureFlag(key)` (`src/hooks/useFeatureFlag.ts`) — thin
wrapper over `useQuery(api.featureFlags.getFeatureFlag, {key})`, returns
`undefined` while loading (callers should treat that as "not yet known", not
default to shown/hidden).

Gated entry points, all skip cleanly (existing data untouched, nothing
deleted):
- `PostAd.tsx` — the "Moving Sale" mode-selector tile is hidden when off;
  falls back straight to the single-item form (there's nothing else to select).
- `MovingSalePage.tsx` (`/sell/moving-sale`) — redirects to `/` if the flag is
  off, same pattern as the existing unauthenticated-user redirect.
- `PublicSalePage.tsx` (`/sale/:slug`) — shows the same "This sale isn't
  available" empty state used for missing/expired sales. A toggled-off flag
  and a bad slug are indistinguishable to the visitor, on purpose.
- `HomePage.tsx` — since the unified feed (2026-07-17) there is NO client-side
  Sale-card query or flag check: `api.feed.getFeed` interleaves Sale cards
  server-side and reads the `movingSaleMode` flag itself (`getActiveSales`
  was deleted; `feed.hydrateSaleCard` preserves its card shape).
- `UserDashboard.tsx` — "Moving sales" sidebar tab is filtered out of the
  SECTIONS array when off; `getSavedSaleEvents` ("Saved Sales" section) is
  also skipped, since surfacing links to a now-gated public page would be
  confusing. A `useEffect` bounces anyone on `?tab=sales` back to `?tab=ads`
  if the flag flips off mid-session (mirrors the existing mobile-archived-tab
  redirect right above it in the same file — **use that exact
  `eslint-disable-next-line react-hooks/set-state-in-effect` comment
  pattern**, this repo's custom lint rule forbids a bare `setState` in an
  effect otherwise).
- `PublishStep.tsx`'s live preview and the seller flow itself
  (`MovingSaleFlow`) aren't separately gated — they're only reachable via the
  already-gated `MovingSalePage` route.

**Test gotcha (again)**: adding `useFeatureFlag` to `PostAd`/`MovingSalePage`/
`PublicSalePage`/`HomePage`/`UserDashboard` means a new `useQuery` call fires
in each. `UserDashboard.test.tsx`'s positional mocks (see the gotcha above)
needed a 5th round of `mockReturnValueOnce`/`mockReturns.push` insertions —
this one at the very front of each sequence, since `useFeatureFlag` is called
near the top of the component, before `getCurrentUserWithStats`.
`MovingSalePage.test.tsx` didn't mock `convex/react` at all before (the
component had no Convex calls); added a `vi.mock('convex/react', () => ({
useQuery: vi.fn() }))` plus a `beforeEach` default of `true`, and a new test
for the disabled-flag redirect.

## Bundle Listing frontend (2026-07-02)

Bundle Listing reuses the `saleBundles` table (standalone bundles have no
`saleEventId`). Backend in `convex/bundles.ts` (exports `BUNDLE_MIN_ITEMS=2`,
`BUNDLE_MAX_ITEMS=4`). Frontend surface:

- `src/features/bundles/BundleFlow.tsx` — 3-step wizard (pick → price → confirm),
  props `{ preselectAdId?: string }`. Uses `api.bundles.getEligibleAdsForBundle`
  (ineligible ads carry a `reason` string: "Sold" / "In another bundle" /
  "In a moving sale") and `createBundle`. On success: `toast.success` +
  `navigate("/dashboard?tab=ads")`.
- `src/pages/BundlePage.tsx` — route shell mirroring `MovingSalePage.tsx`,
  reads `?preselect`, gated on `useFeatureFlag("bundleListing")` (redirects to
  `/` when the flag is explicitly `false`). Route `/sell/bundle` registered in
  `App.tsx` **outside** the `<Layout />` block (full-screen flow), same
  Suspense/ErrorBoundary wrapping as `/sell/moving-sale`.
- `src/features/bundles/BundleManageModal.tsx` — `createPortal` modal (mirrors
  UserDashboard's delete-confirm modal shell). `getBundle` + the edit/remove/
  cancel/markSold mutations. `removeBundleItem` returns `{ status }`; when
  `status === "cancelled"` (dropped below min 2) close + toast "Bundle broken up".
  `markBundleSold` throws if an item already sold individually — caught, message
  shown via `toast.error(err.message)`.

**Accent colour = BLUE** for all bundle UI (Tailwind `blue-600`/`blue-700`,
never raw hex — Moving Sale is red/`primary`). Icon = Phosphor `Package`
weight="fill".

**Dashboard integration** (`UserDashboard.tsx`, all flag-gated on
`bundleModeEnabled = useFeatureFlag("bundleListing")`): a blue outline
"Bundle ads" button beside "Pin Next Flyer"; `getMyBundles` → a
`Map<adId,{bundleId,label}>` for per-card tags; each ad card shows either a
blue "In bundle: {label}" tag (opens `BundleManageModal`) or a "Bundle this →"
action (navigates `/sell/bundle?preselect={adId}`) when the ad is eligible
(`!isSold && !bundleId && !saleEventId`). Both handlers `stopPropagation` so
they don't trigger the card's edit-on-click.

**Test gotcha (again — see positional-mock note above)**: the two new hooks
(`useFeatureFlag("bundleListing")` right after `movingSaleMode`, and
`getMyBundles` right after `getUserAds`) added TWO slots to
`UserDashboard.test.tsx`'s positional `useQuery` mocks. All four
`mockReturnValueOnce` blocks, the counter-based `mockReturns.push` block, and
the `makeCyclingQueryMock` sequence needed the extra `false` (bundleListing)
and `undefined` (getMyBundles) entries inserted in order.

**Framer-motion test gotcha**: `BundleFlow` uses `<AnimatePresence mode="wait">`
for step transitions. In jsdom the exit transition never completes, so the
previous step stays mounted and `getByText` for the next step fails. Fix in
`BundleFlow.test.tsx`: `vi.mock("framer-motion")` to make `AnimatePresence` a
passthrough `Fragment`, `motion.*` plain forwarded elements (strip motion-only
props), and `useReducedMotion` → `true`.
