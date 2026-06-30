# Moving Sale Mode

**Last Updated**: 2026-06-30

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
