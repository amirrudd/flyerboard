# FlyerBoard — User Journeys (Master Index)

Canonical map of every user journey across the web app, for test planning and product visibility. Journeys are documented per-feature in Given/When/Then form; this file is the index plus the consolidated list of broken / half-wired flows found during the July 2026 journey audit.

_Last audited: 2026-07-19 (9 parallel domain audits against live code)._

## Per-feature journey docs

| Domain | Doc | Journeys | Route(s) |
|---|---|---:|---|
| Auth | [`src/features/auth/USER_JOURNEYS.md`](../src/features/auth/USER_JOURNEYS.md) | 24 | global modal |
| Ads — browse & detail | [`src/features/ads/USER_JOURNEYS.md`](../src/features/ads/USER_JOURNEYS.md) | 50 | `/`, `/ad/:id` |
| Ads — posting / edit / delete | [`src/features/ads/POSTING_USER_JOURNEYS.md`](../src/features/ads/POSTING_USER_JOURNEYS.md) | 24 | `/post` |
| Dashboard | [`src/features/dashboard/USER_JOURNEYS.md`](../src/features/dashboard/USER_JOURNEYS.md) | 38 | `/dashboard` |
| Messaging | [`src/features/messages/USER_JOURNEYS.md`](../src/features/messages/USER_JOURNEYS.md) | 31 | `/messages/:chatId?` |
| Moving Sale | [`src/features/movingSale/USER_JOURNEYS.md`](../src/features/movingSale/USER_JOURNEYS.md) | 48 | `/sell/moving-sale`, `/sale/:slug` |
| Bundles | [`src/features/bundles/USER_JOURNEYS.md`](../src/features/bundles/USER_JOURNEYS.md) | 45 | `/sell/bundle`, `/bundle/:id` |
| Admin | [`src/features/admin/USER_JOURNEYS.md`](../src/features/admin/USER_JOURNEYS.md) | 73 | `/admin` |
| Layout / nav / static / blog / PWA | [`src/features/layout/USER_JOURNEYS.md`](../src/features/layout/USER_JOURNEYS.md) | 42 | shell, `/blog`, `/terms`, `/support`, `/about`, `/community-guidelines`, 404 |

~375 documented journeys. Each doc is the source of truth for its domain; update it when the flow changes.

## Route → domain map

- `/` — home feed (ads + Bundle cards + Sale cards interleaved on `bumpedAt`) → Ads browse, Layout
- `/ad/:id` — flyer detail → Ads browse & detail
- `/post` — create/edit flyer → Ads posting
- `/dashboard` — seller account (my flyers, saved, bundles, sales, profile) → Dashboard
- `/messages/:chatId?` — unified inbox (buying + selling + sale + bundle threads) → Messaging
- `/sell/moving-sale` — sale create wizard (outside Layout) → Moving Sale
- `/sale/:slug` — public sale page → Moving Sale
- `/sell/bundle` — bundle create wizard (outside Layout) → Bundles
- `/bundle/:id` — public bundle deal-ticket → Bundles
- `/admin` — admin dashboard (7 tabs) → Admin
- `/blog`, `/blog/:slug`, `/terms`, `/community-guidelines`, `/support`, `/about`, `*` (404) → Layout/static

## Consolidated broken / half-wired flows

Ranked by severity. All findings were adversarially re-verified against live code on 2026-07-19; items marked **FIXED** were resolved the same day (see `.agent/plans/user-journey-fixes.md` for the fix plan).

### FIXED (2026-07-19)
- ✅ **CRITICAL — `categories.updateCategories` public ungated wipe mutation.** Deleted outright (was `@deprecated`, only caller was dead code in `HomePage.tsx`). Every remaining `categories` mutation is `requireAdmin`-gated.
- ✅ **HIGH — Buyer's flyer messages never notified the seller.** `adDetail.sendFirstMessage`/`sendMessage` now schedule push + queue email, mirroring `messages.sendMessage`. Also brought up to parity on rate limits (`createChat` 20/hr on new chats, `sendMessage` 60/min).
- ✅ **HIGH — Dashboard delete-flyer dead UI.** Resolved by removing the orphaned modal/handler (~50 lines) — deletion deliberately lives in the `/post` edit form ("Delete Flyer" button); there wasn't space in the dashboard card row. (Still true: no `restoreAd` mutation exists; deleted flyers aren't user-recoverable.)
- ✅ **HIGH — Moving Sale: no "mark item sold" UI.** Owner viewing their own live sale (`/sale/:slug`) now taps an item to toggle sold/unsold ("Tap to mark sold" / "Tap to unmark" chip), wired to the existing `saleEvents.setItemSold`. Works in both A/B page variants.
- ✅ **MEDIUM — Seller replies to Bundle threads skipped notifications.** `messages.sendMessage` notification gates now include `chat.bundleId` and pass it through to push/email handlers.
- ✅ **MEDIUM — Soft-deleted flyers appeared as live message threads.** `messages.sendMessage` now blocks sends on a deleted flyer's thread; `posts.getSellerChats`/`getBuyerChats` null out soft-deleted ads so threads render "No longer available" with a disabled composer.
- ✅ **MEDIUM — Partial-create orphan flyer.** A failed image upload / finalize during ad creation now soft-deletes the just-created ad instead of leaving a live imageless listing in the feed.
- ✅ **MEDIUM — Bundle CTA offered ineligible exchange ads.** Dashboard eligibility now mirrors the backend (`listingType !== "exchange"`).

### FIXED (2026-07-20, PO + UX agent-planned)
- ✅ **HIGH — Moving Sale: no edit / end for a LIVE sale.** Shipped per product-owner scoping: `endSaleEvent` mutation (owner-only, idempotent, `active → ended`); daily cron auto-ends sales past `expiresAt` (previously nothing consumed it — stale sales sat in the feed forever); wizard resume for active sales lands on Review (all edit mutations already worked on active sales — only routing blocked them); dashboard live-sale card gained Edit + End sale (confirm modal); ended public page is a read-only record ("Sale ended" badge, note instead of countdown, no message/save footer); dashboard "Ended" badge now reachable. *Deliberate: no delete — "ended" is the single end-of-life concept (soft-delete rule).*
- ✅ **MEDIUM — Support form stub.** Real backend: `supportRequests` table (audit trail) + `support.submitSupportRequest` (auth + `supportRequest` rate limit 3/day, admin-tunable) + Resend email to support@flyerboard.com.au with reply-to. Inline success/error/rate-limit states replace the fake toast; signed-out users get "Sign in to send" via the Layout auth modal + the mailto card; SMS-only accounts (no email) get an inline email field.

### OPEN — MEDIUM
- **Bundle `partial` state unreachable in prod.** `markBundleItemSold` has no frontend caller; a bundle only reaches `partial` via member soft-delete.
- **Sale/wizard auth = silent hard redirect.** `/sell/moving-sale` and `/sell/bundle` sit outside `<Layout>`, so they structurally can't show the sign-in modal; unauthenticated users are bounced to `/` with no prompt.
- **Sale add-ons stubbed but presented as paid.** `purchaseAddon` (`saleEvents.ts:505`) unlocks flyer/pin for free with a "unlocked / pinned for 7 days" toast — no Stripe. (AI add-on correctly shows "Coming soon".)

### LOW (representative — full lists in per-feature docs)
- Sync-failure auth error is swallowed (`useDescopeUserSync.ts:57`); recovery UI never propagates. Dead `AuthRecoveryProvider` machinery.
- Dashboard authed queries not gated on `isUserSynced` (fail soft → skeleton flash, not errors).
- `toggleAdStatus` and `saveAd`/`saveBundle` have no rate limits.
- No-savings bundles ($0 / 0% off) are creatable.
- No report-a-sale flow (ad detail has one).
- Server-side create/update validation is thin (no min-length/price bounds/category-existence on direct API calls).
- Orphaned R2 objects on failed/edited uploads (image cleanup only targets soft-deleted ads).
- Blog client-side `og:image` falls back to the generic brand card; About hero loads from an external Wikimedia URL; `manifest.json` `theme_color` (`#ea580c`) drifted from brand `#dc3626`.
- Home page has no isolated ErrorBoundary (eager route under app-level boundary only).

## Verified-correct invariants (not broken)

- Soft-delete `.neq(isDeleted, true)` present on all ad read paths (feed, search, detail).
- Every owner mutation calls `getDescopeUserId` + ownership check; `deleteAd` stamps `deletedAt` and detaches from bundles; boost is flag/cooldown/rate-limit fail-closed.
- The historical `reports.getAllReports` leak is fixed (now `admin.ts:153` behind `requireAdmin`); every `admin.ts` function, `appSettings`, and `featureFlags` mutation is `requireAdmin`-gated; `updateSetting` validates ranges (rejects, not clamps).
- Message-modal auth for `/sale/:slug` and `/bundle/:id` correctly uses the Layout outlet-context sign-in modal (both routes are inside `<Layout>`).
- Inbox/thread/unread queries are gated on `isAuthenticated && !isSessionLoading && isUserSynced`; own-sends never count as unread; two-sided delete only hard-deletes when both parties delete.
- Mobile wizard scroll regression is fixed and guarded by `e2e/wizard-mobile-scroll.spec.ts`.
