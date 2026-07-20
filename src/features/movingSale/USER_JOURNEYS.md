# Moving Sale Feature - User Journeys

This document captures all user journeys and flows for the Moving Sale feature
package. Every journey below is traced from the actual code (no aspirational
flows). Where a flow is stubbed or unreachable, it is noted inline and listed in
the "Known gaps" section at the end.

Key files: `src/pages/MovingSalePage.tsx`, `src/pages/PublicSalePage.tsx`,
`src/features/movingSale/*`, `src/features/dashboard/MovingSalesTab.tsx`,
`convex/saleEvents.ts`, `convex/saleChats.ts`.

---

## A. Entering the create flow

### 1. Enter Moving Sale mode from the Post Ad form
**Given** the user is on the Post Ad page and `movingSaleMode` is enabled
**When** they tap the "Moving Sale" mode-selector tile (`PostAd.tsx:439`)
**Then** they are navigated to `/sell/moving-sale` with `state.from = "/post"` (so a pre-publish exit returns to `/post`)

### 2. Discard an in-progress ad when switching to Moving Sale
**Given** the user has typed into the Post Ad form (form is dirty)
**When** they tap the Moving Sale tile
**Then** a `window.confirm` warns the entered data will be discarded, and navigation only proceeds if they confirm (`PostAd.tsx:459`)

### 3. Enter Moving Sale from the dashboard
**Given** the user is on their dashboard
**When** they tap "New sale" in the Moving Sales tab, the "Start a moving sale" empty-state button, or the My Flyers entry banner
**Then** they are navigated to `/sell/moving-sale` (`MovingSalesTab.tsx:54,80`, `UserDashboard.tsx:1161`)

### 4. Mode selector hidden when feature is off
**Given** `movingSaleMode` is disabled
**When** the user opens the Post Ad page
**Then** the Moving Sale tile is not rendered and the form falls straight through to the single-item flow (`PostAd.tsx:439`)

### 5. Authentication gate on the wizard route
**Given** the user is not authenticated
**When** they navigate to `/sell/moving-sale`
**Then** they are redirected to `/` with `replace: true` — no sign-in modal is offered (the route lives outside `Layout`, so it cannot show the global sign-in modal) (`MovingSalePage.tsx:16-20`)

### 6. Feature-flag safety-net redirect
**Given** `movingSaleMode` is disabled
**When** the user reaches `/sell/moving-sale` via a bookmark or direct link
**Then** they are redirected to `/` (`MovingSalePage.tsx:24-28`)

### 7. Wizard loading state
**Given** the session or feature flag is still resolving, or a resumed draft's editor data is still loading
**When** the wizard mounts
**Then** a full-screen `PageLoader` is shown until `isAuthenticated && !isSessionLoading && isUserSynced` and the editor query resolves (`MovingSalePage.tsx:30`, `MovingSaleFlow.tsx:136-140`)

---

## B. The create wizard (seller)

### 8. View the intro screen
**Given** a new (non-resumed) wizard session
**When** the wizard opens
**Then** the full-bleed Intro step is shown with the three value points and a "Start my moving sale" CTA; "Free to create & publish · optional paid add-ons" is displayed (`MovingSaleFlow.tsx:152,224`)

### 9. Set up the sale
**Given** the user is on the Setup step
**When** they enter title, suburb, optional note, and pick a pickup-window preset, then submit
**Then** `createSaleEvent` mints a draft `saleEvents` row (status `draft`) — or `updateSaleEvent` on a resumed draft — and the wizard advances to Upload (`MovingSaleFlow.tsx:99-112`, `saleEvents.ts:140,183`)

### 10. Bulk-upload item photos
**Given** the user is on the Upload step with a created sale
**When** they add photos
**Then** each image is uploaded to R2 under `flyers/{saleEventId}/` and `addSaleItems` creates draft items (`isActive: false`, placeholder titles like "Item 3", no price, default category), enforcing a 100-item abuse ceiling (`saleEvents.ts:222`)

### 11. Review items card-by-card
**Given** items were uploaded as drafts
**When** the user reaches the Review step
**Then** each item is shown one at a time with an AI-confidence badge derived from draft completeness (`itemConfidence` in `saleHelpers.ts` — real title+price = high, one = medium, neither = low), an inline price stepper, and a `BottomSheet` edit sheet for title/condition/category (`ReviewStep.tsx`)

### 12. Approve, skip, and second-pass review
**Given** the user is reviewing items
**When** they approve or skip ("Later") an item
**Then** the item is recorded in a `decided` map; pending items are shown first, then skipped items get a second pass; when all are decided the step can complete (`ReviewStep.tsx:36,53-56,83`)

### 13. Edit an item's details
**Given** the user opens the edit sheet for an item
**When** they change title/condition/category/price and save
**Then** `updateSaleItem` persists the change (owner-checked) (`ReviewStep.tsx:64`, `saleEvents.ts:304`)

### 14. Remove an item from the sale
**Given** the user is editing an item in Review
**When** they remove it
**Then** `removeSaleItem` soft-deletes the ad (`isDeleted: true`, `isActive: false`, stamps `deletedAt`) — it stays out of the sale and the feed (`ReviewStep.tsx:264`, `saleEvents.ts:338-355`)

### 15. Bundle items together
**Given** the user is on the Bundles step
**When** they accept a category-based suggestion or build a custom bundle
**Then** `setBundles` replaces all bundles for the sale and restamps `ads.bundleId` (`BundlesStep`, `saleEvents.ts:390`)

### 16. Preview and publish (free)
**Given** the user is on the Publish step
**When** they review the un-blurred `PublicSaleView` preview (Variant A only) and tap publish
**Then** `publishSaleEvent` mints a permanent slug, flips status to `active`, activates the items into the feed, and stamps `bumpedAt` — no payment gate (`PublishStep.tsx:40`, `saleEvents.ts:452-483`)

### 17. Share the published sale
**Given** the sale is published
**When** the user reaches the Share step
**Then** they can copy the link or use the native share sheet for free; QR + printable A4 flyer is gated behind the `flyer` add-on, a 7-day search pin behind the `pin` add-on, and AI bulk-listing shows a disabled "Coming soon" (`ShareStep.tsx:204,245,282,300`)

### 18. Print a flyer (after flyer add-on)
**Given** the `flyer` add-on is unlocked
**When** the user taps "Printable A4 flyer"
**Then** a self-contained HTML flyer (with an inlined QR data URL) opens in a new window for browser print-to-PDF; if pop-ups are blocked, an error toast is shown (`ShareStep.tsx:160-170`)

### 19. Purchase an add-on (STUB — no payment)
**Given** the user is on the Share step
**When** they tap "Unlock" on the flyer or 7-day pin add-on
**Then** `purchaseAddon` immediately flips `unlockedAddons` / `pinnedUntil` and a success toast ("QR + flyer unlocked" / "Sale pinned for 7 days") is shown — there is no Stripe/checkout step (`ShareStep.tsx:147-152`, `saleEvents.ts:505`)

### 20. Finish the wizard
**Given** the user is on the Share step
**When** they tap Done
**Then** they are navigated to `/dashboard` (`MovingSaleFlow.tsx:217`)

### 21. Navigate back / exit the wizard
**Given** the user is mid-wizard
**When** they tap Back or Exit
**Then** Back steps to the previous step; Exit navigates to `exitTarget` (`/post` if entered from Post Ad, else `/dashboard`) (`MovingSaleFlow.tsx:114-134,149`)

### 22. Resume a draft
**Given** the user has an unpublished draft
**When** they open `/sell/moving-sale?sale=<id>` (dashboard "Continue")
**Then** the editor loads and the wizard jumps to Upload (no items) or Review (has items); a resumed *active* sale jumps to the Share step instead of the editor (`MovingSaleFlow.tsx:68-76`)

### 23. Resume a removed/foreign sale
**Given** the `?sale=<id>` points to a deleted sale or one owned by another user
**When** the wizard loads and `getSaleEditor` returns null
**Then** an error toast ("That sale isn't available…") is shown and the user is redirected to `/dashboard` (`MovingSaleFlow.tsx:50-59`)

---

## C. Public sale page (buyer)

### 24. View a public sale page
**Given** a visitor opens `/sale/:slug`
**When** the page loads and `getSaleBySlug` returns a non-draft sale
**Then** the buyer-facing sale page renders (items, bundles, seller, pickup window) inside the app `Layout` (`PublicSalePage.tsx:21,108`)

### 25. A/B design variant selection
**Given** a visitor loads the sale page
**When** the variant is resolved
**Then** a `?variant=a|b` URL override wins; else the `movingSaleDesignForceB` admin flag forces Variant B; else a per-browser 50/50 localStorage coin flip decides between `PublicSaleView` (A) and `PublicSaleViewEditorial` (B) (`PublicSalePage.tsx:25-30`, `useSaleDesignVariant.ts`)

### 26. Live countdown to pickup
**Given** the sale page is open
**When** the pickup window is in the future
**Then** a live days/hours/mins/secs countdown ticks down to the pickup start (`PublicSaleView.tsx:61,123`, `useCountdown.ts`)

### 27. Filter items by category
**Given** the sale has items across multiple categories
**When** the visitor taps a category pill
**Then** only items in that category are shown; only categories actually present in the sale get pills (`PublicSaleView.tsx:81`)

### 28. Sold items shown but not clickable
**Given** an item is marked sold (`isSold`)
**When** the sale page renders it
**Then** it appears greyed/grayscale with a "Sold" badge and is not tappable (`PublicSaleView.tsx:276,285,289`)

### 29. Message the seller about the whole sale
**Given** a visitor is on the sale page
**When** they tap "Message {seller}"
**Then** the `SaleMessageModal` opens on the sale-level thread with no item pre-selected (`PublicSalePage.tsx:96,136`)

### 30. Ask about a specific item
**Given** a visitor taps an available item
**When** the modal opens
**Then** that item is pre-attached as a chip (`referencedAdIds`) in the composer, on the same one-per-buyer sale thread (`PublicSalePage.tsx:102`, `SaleMessageModal.tsx:66-73`)

### 31. Sign-in gate inside the message modal
**Given** a signed-out visitor opens the message modal (or taps Send)
**When** they are not authenticated/synced
**Then** the thread area shows a "Sign in to message…" prompt; tapping Sign in calls `layoutCtx.setShowAuthModal(true)`, opening Layout's `SmsOtpSignIn` via outlet context (works because the sale page is inside `Layout`) (`SaleMessageModal.tsx:50-51,107-109,163-175`)

### 32. Send a sale message
**Given** an authenticated, synced buyer with text entered
**When** they tap Send
**Then** `sendSaleMessage` creates/reuses one thread per (sale, buyer), stores the message with any item chips, and fires push + queued-email notifications to the seller (`SaleMessageModal.tsx:104-126`, `saleChats.ts:21,93-115`)

### 33. Message thread states
**Given** the modal is open for an authenticated user
**When** the thread query resolves
**Then** a spinner shows while loading, an empty-state prompt shows for a new thread, and messages render mine-right / theirs-left with item chips (`SaleMessageModal.tsx:176-218`)

### 34. Save (bookmark) the whole sale
**Given** an authenticated visitor on the sale page
**When** they tap the bookmark button
**Then** `saveSaleEvent` toggles the sale in `savedSaleEvents` with an optimistic pop animation; a signed-out user instead gets a "Please sign in to save" toast (no modal) (`PublicSaleView.tsx:63`, `useSaveSaleEvent.ts`, `useSaveToggle.ts:38`)

### 35. Share the sale
**Given** a visitor on the sale page
**When** they tap Share
**Then** the native share sheet opens (or the URL is copied to clipboard) with a pop animation (`PublicSalePage.tsx:121`, `PublicSaleView.tsx:66,359`)

### 36. Sale-page header (back / wordmark / theme)
**Given** the sale page is open
**When** it registers header slots on the persistent `Layout` header
**Then** the header shows a "Back to flyers" control, the FlyerBoard wordmark, and a theme toggle (`PublicSalePage.tsx:41-62`)

### 37. Unavailable-sale empty state
**Given** the slug is unknown, the sale is still a draft, or `movingSaleMode` is disabled
**When** the page resolves
**Then** the same "This sale isn't available" empty state with a "Browse FlyerBoard" button is shown (a disabled flag and a bad slug are indistinguishable, on purpose) (`PublicSalePage.tsx:64-91`, `saleEvents.ts:598`)

### 38. Sale-page loading state
**Given** the sale query or feature flag is still resolving
**When** the page mounts
**Then** a `PageLoader` is shown (`PublicSalePage.tsx:64`)

---

## D. Sale in the home feed

### 39. Sale rendered as one feed card
**Given** the home (uncategorised) feed is loading
**When** `api.feed.getFeed` interleaves a published sale
**Then** the sale renders as a single card in the date-sorted grid using the same `motion.article` shell as an ad card (`AdsGrid` `saleCards` prop), server-side flag-gated (`gatheredContext/features/moving-sale.md`, v3)

### 40. 2×2 thumbnail degradation ladder
**Given** a sale feed card
**When** it renders its thumbnail
**Then** `SaleThumbnail` degrades by photo count: 4+ → 3 covers + "+N items" overlay · 3 → 2×2 with a placeholder cell · 2 → two strips · 1 → single · 0 → house + suburb placeholder, with a red "Moving Sale" badge, "from $X" price, and "N items" footer (`SaleThumbnail.tsx:17-26`)

### 41. Open a sale from the feed
**Given** a visitor sees a sale card
**When** they tap it
**Then** they navigate to `/sale/:slug` (`AdsGrid` `onSaleClick`)

### 42. Sale items also appear as ordinary listings
**Given** a sale is published
**When** its items appear in the feed
**Then** each item renders as a normal single listing with no badge or strip (discovery of the sale happens on the item's detail page, not the feed) (`gatheredContext/features/moving-sale.md`, v3.1)

### 43. Ad-detail "part of a moving sale" banner
**Given** a visitor opens an ad that belongs to a published sale
**When** the detail page loads
**Then** a banner ("Part of {Name}'s Moving Sale", suburb · N items · pickup · from $X, plus a thumbnail strip) links to the sale; sold items show "This item has sold · N items still available" (`getSaleBannerForAd`, `saleEvents.ts:659`, `AdDetail.tsx`)

---

## E. Managing sales (dashboard)

### 44. View my moving sales
**Given** the user opens the Moving Sales dashboard tab
**When** `getMySaleEvents` resolves
**Then** each sale is listed with cover image, status badge (Draft / Live / Ended), suburb, pickup, and available/sold/total-value stats (`MovingSalesTab.tsx:16-127`)

### 45. Continue a draft
**Given** a listed sale is a draft (or ended)
**When** the user taps "Continue"
**Then** they navigate to `/sell/moving-sale?sale=<id>` to resume the wizard (`MovingSalesTab.tsx:150`)

### 46. View / share a live sale
**Given** a listed sale is active with a slug
**When** the user taps "View page" or "Share"
**Then** "View page" navigates to `/sale/:slug`; "Share" opens the native share sheet or copies the link (`MovingSalesTab.tsx:130-145`)

### 47. Saved sales section
**Given** the user has bookmarked sales
**When** they open the dashboard Saved tab
**Then** a "Saved Sales" section (from `getSavedSaleEvents`) renders above "Saved Ads", only when non-empty (`saleEvents.ts:751`, `UserDashboard.tsx`)

### 48. Empty and loading states
**Given** the user has no sales, or the query is loading
**When** the tab renders
**Then** loading shows `AdListingSkeleton`s and empty shows a "No moving sales yet" state with a start CTA (`MovingSalesTab.tsx:61-85`)

---

## Known gaps / unwired flows (not user journeys — documented so future sessions don't assume they work)

- **No "mark item sold" UI.** `setItemSold` (`saleEvents.ts:364`) has zero frontend callers — the "Sold" rendering on the public page (journey 28) is only reachable via seed data. Sellers cannot mark items sold.
- **No edit/delete/end for a live sale.** Resuming an active sale jumps to Share, not the editor; there is no `deleteSaleEvent` / `endSaleEvent` mutation, so the "Ended" status (`MovingSalesTab.tsx:13`) is unreachable. Item edit/remove (journeys 13–14) only work while the sale is a draft.
- **Add-ons are stubbed** (journey 19): flyer + pin "unlock" for free with a paid-sounding toast; AI add-on is correctly a disabled "Coming soon".
- **AI photo-to-listing is stubbed**: uploads become placeholder "Item N" drafts; the "AI confidence" badge is derived from draft completeness, not a vision model.
- **No report-a-sale flow**: the public sale page has no report affordance (unlike ad detail pages).
