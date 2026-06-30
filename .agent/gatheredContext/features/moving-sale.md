# Moving Sale Mode

**Last Updated**: 2026-06-30 (v3.1)

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
- `getActiveSales` returns `{ slug,title,suburb,createdAt,itemCount,photoCount,minPrice,covers }`
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
  chips (`messages.referencedAdIds`). Frontend: `SaleMessageModal` on the public page (reuses the
  app `AuthModal` for the Descope gate). **Gotcha:** making `chats.adId` optional broke 6 call
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
  bundles→paywall→share). Drives everything off `getSaleEditor` (reactive).
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
