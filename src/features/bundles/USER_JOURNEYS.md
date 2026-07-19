# Bundles Feature - User Journeys

This document captures all user journeys and flows for the Bundle Listing feature
package. A "bundle" groups 2–N of a seller's own standalone ads at a discounted
package price. Every bundle reuses the `saleBundles` table (a standalone bundle
leaves `saleEventId` undefined). Backend: `convex/bundles.ts`, `convex/bundleChats.ts`.
Wizard: `src/pages/BundlePage.tsx` → `src/features/bundles/BundleFlow.tsx`. Public
page: `src/pages/PublicBundlePage.tsx` → `PublicBundleView.tsx`.

Every journey below is traced to code — no aspirational flows.

## Creating a bundle (wizard)

## 1. Open the Bundle Wizard (Authenticated + Flag On)
**Given** the user is authenticated and the `bundleListing` feature flag is on
**When** they navigate to `/sell/bundle` (a full-screen route rendered outside the app `Layout`)
**Then** the 3-step wizard (`pick → price → confirm`) is shown, seeded with the caller's eligible ads

## 2. Redirect Unauthenticated Users from the Wizard
**Given** the user is not authenticated
**When** they navigate to `/sell/bundle`
**Then** once the session resolves they are redirected to `/` (BundlePage effect), and a `PageLoader` shows meanwhile

## 3. Redirect When the Feature Flag Is Off
**Given** the `bundleListing` flag is disabled
**When** the user reaches `/sell/bundle` directly (bookmark/deep link)
**Then** they are redirected to `/` (safety-net effect in BundlePage); dashboard entry points already hide the buttons

## 4. Pick Items to Bundle
**Given** the user is on the "pick" step
**When** they tap eligible listing tiles
**Then** each toggles selected (teal ring + check), with a live "X of MAX selected" counter

## 5. Ineligible Items Are Blocked with a Reason
**Given** the user's ad is sold, trade-only (`exchange`), already in another bundle, or in a moving sale
**When** the picker grid renders (`getEligibleAdsForBundle`)
**Then** that tile is dimmed, disabled, and labelled with its reason ("Sold" / "Trade-only" / "In another bundle" / "In a moving sale")

## 6. Enforce Min/Max Item Count
**Given** the user is selecting items
**When** they have fewer than 2 selected
**Then** the "Set a bundle price" button stays disabled ("Select at least 2"); selection caps at the admin-tunable `bundleMaxItems` max (default from `appConfig`), and the server re-enforces both bounds in `createBundle`

## 7. Empty Picker State
**Given** the user has fewer than two eligible listings
**When** the pick step renders
**Then** a Package empty state explains they need at least two available listings not already in a bundle or sale

## 8. Preselect an Item from the Dashboard
**Given** the user clicked "Add to a bundle" on a dashboard ad card
**When** the wizard opens via `/sell/bundle?preselect=<adId>`
**Then** that ad is pre-added to the selection

## 9. Set Bundle Price, Label, and See Savings
**Given** the user is on the "price" step with items chosen
**When** they enter a package price (and optionally a custom label)
**Then** a live "separately total → bundle price", savings amount, and savings % preview updates; label defaults to an auto-name ("Sofa + Dining table" / "Sofa + 2 more")

## 10. No-Savings Warning
**Given** the entered bundle price is ≥ the separately total
**When** the price step recomputes
**Then** a `noSaving` warning surfaces — but this does NOT block proceeding (`canCreate` only requires price > 0), so a zero/negative-savings bundle is still creatable

## 11. Confirm and Create the Bundle
**Given** the user is on the "confirm" step with a valid selection and price
**When** they submit
**Then** `createBundle` runs (rate-limited, re-validates every ad's ownership + eligibility), each ad gains a `bundleId`, a success toast shows, and they return to `/dashboard?tab=ads`

## 12. Create Failure Handling
**Given** `createBundle` throws (rate limit, an item became ineligible, price ≤ 0)
**When** the mutation rejects
**Then** the error message is surfaced as a toast and the confirm button re-enables

## Dashboard entry points & management

## 13. "Add to a Bundle" CTA on an Ad Card
**Given** the flag is on and a dashboard ad is not sold, not in a bundle, and not in a sale
**When** the card renders
**Then** an "Add to a bundle" pill is shown, linking to the preselect wizard

## 14. "In Bundle" Tag on a Bundled Ad Card
**Given** a dashboard ad already belongs to a bundle
**When** the card renders
**Then** an "In bundle: {label}" pill is shown that opens the manage modal instead of the wizard

## 15. View My Bundles (Bundles Tab)
**Given** the user opens the dashboard Bundles tab
**When** `getMyBundles` resolves
**Then** their active/partial/sold bundles are listed newest-first (cancelled and Sale-scoped ones excluded), each with savings and item thumbnails; a "Create a bundle" entry links to `/sell/bundle`

## 16. Open the Manage Modal
**Given** the user has a bundle
**When** they click it in the Bundles tab (or the "In bundle" tag)
**Then** `BundleManageModal` opens with `getBundle` (owner-only payload; renders "no longer available" if the query returns null)

## 17. Edit the Bundle Price
**Given** the bundle is `active` or `partial`
**When** the owner changes the price field and clicks Save
**Then** `updateBundlePrice` runs (price must be > 0; rejected for sold/cancelled bundles) and a success toast shows

## 18. Remove an Item from a Bundle
**Given** the bundle is editable and has more than the minimum items
**When** the owner removes one item
**Then** that ad reverts to standalone (`bundleId` cleared); if the remaining count drops below 2 the whole bundle is cancelled ("Bundle broken up") and survivors revert to standalone

## 19. Mark the Bundle Sold as a Set
**Given** the bundle is `active`
**When** the owner clicks "Mark sold as a bundle"
**Then** `markBundleSold` marks every member `isSold` atomically, sets status `sold`, and closes the modal

## 20. Mark-Sold Race (an item already went)
**Given** one member ad was already sold individually
**When** the owner tries "Mark sold as a bundle"
**Then** the mutation asserts first and throws ("an item already sold — bundle deal no longer available") with no partial writes; the error is toasted

## 21. Cancel / Break Up the Bundle
**Given** the bundle is not already sold/cancelled
**When** the owner confirms "Cancel bundle"
**Then** `cancelBundle` frees every member's `bundleId`, sets status `cancelled`, and closes the modal (items become plain standalone listings)

## 22. Non-Editable Manage States
**Given** the bundle is `partial`, `sold`, or `cancelled`
**When** the manage modal renders
**Then** a status notice explains why, the price editor and per-item Remove buttons are hidden, and only the still-valid actions remain

## Public bundle page (Deal Ticket)

## 23. View a Public Bundle Page
**Given** anyone (auth not required) opens `/bundle/:id`
**When** `getPublicBundle` resolves an active bundle
**Then** the receipt-style "Deal Ticket" renders: line-item prices, struck-through separately total, large bundle price, save stamp, image strip, and seller card

## 24. Invalid / Cancelled / Expired Bundle Link
**Given** the id is malformed, or the bundle is missing/deleted/cancelled/Sale-scoped
**When** `getPublicBundle` returns null (it takes a raw string and `normalizeId`s it, so a bad id never throws)
**Then** a friendly "This bundle isn't available" empty state with a "Browse FlyerBoard" button is shown

## 25. Public Page While Feature Is Off
**Given** the `bundleListing` flag is disabled
**When** a user opens `/bundle/:id`
**Then** the same friendly empty state is shown (flag checked client-side in PublicBundlePage)

## 26. Partial Bundle — Buy Remaining Individually
**Given** a bundle is `partial` (an item sold, deal gone)
**When** the public page renders
**Then** a notice says the bundle is no longer available and lists "Buy {item} for {price} ›" links to each still-available member ad instead of the package price

## 27. Sold Bundle Public Page
**Given** a bundle is `sold`
**When** the public page renders
**Then** the sold-items are greyed with SOLD pills, a "This bundle has been sold" notice replaces the deal, and the CTA reads "This bundle has been sold" (no message button)

## 28. Owner Viewing Their Own Bundle
**Given** the signed-in viewer owns the bundle (`isOwner`)
**When** the public page renders
**Then** the sticky CTA becomes "This is your bundle — manage it", navigating to `/dashboard?tab=bundles`

## 29. Save / Unsave a Bundle
**Given** the user is signed in and viewing a bundle
**When** they tap the bookmark button
**Then** `saveBundle` toggles a `savedBundles` row (optimistic via `useSaveToggle`) with a "Bundle saved / removed" toast and pop animation

## 30. Save While Not Signed In
**Given** the viewer is anonymous (or their user record hasn't synced yet, so `getCurrentUser` is null)
**When** they tap the bookmark
**Then** `useSaveToggle` short-circuits with a "Please sign in to save this bundle" toast (the save mutation is not attempted)

## 31. Saved Bundles in the Dashboard
**Given** the user has bookmarked bundles
**When** the Saved tab loads `getSavedBundles`
**Then** each saved bundle's card renders; rows whose bundle is now deleted/cancelled/Sale-scoped/empty are filtered out

## 32. Share a Bundle
**Given** the user is on a public bundle page
**When** they tap the share button
**Then** `sharePage(bundle.label)` shares/copies the bundle URL

## 33. Open a Member Item from the Bundle Page
**Given** the user is on the public bundle page
**When** they tap an item in the line-items, the image strip, or a partial "Buy X" link
**Then** they navigate to that member ad's detail page (`/ad/:adId`)

## 34. Public Page Loading State
**Given** the bundle query or the feature-flag query is still resolving
**When** the page mounts
**Then** a `PageLoader` is shown until both settle

## Bundle messaging

## 35. Message the Seller About a Bundle
**Given** a signed-in, synced buyer (not the owner) is on a public bundle page
**When** they open the message modal and send a message
**Then** `sendBundleMessage` creates one thread per buyer per bundle (`chats.bundleId`, `by_bundle_buyer`), delivers the message, and queues push/email notifications; the thread also appears in the unified inbox

## 36. Sign-In Prompt Inside the Message Modal
**Given** the viewer is not authenticated/synced
**When** they open the bundle message modal
**Then** a "Sign in to message {seller}" prompt is shown whose button calls the Layout-owned auth modal via `useOutletContext` (the page is inside the `Layout` route, so the context is present; it no-ops harmlessly in tests rendered outside the router)

## 37. Empty Thread, Send, and Auto-Scroll
**Given** the buyer's bundle thread has no messages yet
**When** the modal opens
**Then** a "Start the conversation" prompt shows; sending appends a bubble via the shared `MessageComposer`/`MessageBubble`, and the thread auto-scrolls to the latest message

## 38. Seller Cannot Message Their Own Bundle
**Given** the bundle owner opens the message flow
**When** `sendBundleMessage` runs (or `getPublicBundle` reports `isOwner`)
**Then** the server rejects "You can't message your own bundle" and the UI shows the "manage it" CTA instead of a message button

## Feed & ad-detail surfaces

## 39. Bundle Card in the Home Feed
**Given** the flag is on and a standalone bundle is active with ≥2 live (non-sold) members
**When** the unified `getFeed` query interleaves entries on `bumpedAt`
**Then** a Bundle card renders in `AdsGrid` — a 2–4 strip `BundleThumbnail`, a "Bundle" badge, label, location, struck-through separately total, bundle price, item count, and a "Save $X" stamp

## 40. Open a Bundle from the Feed
**Given** the user sees a bundle card in the feed
**When** they click it (or Enter/Space)
**Then** they navigate to the bundle's `/bundle/:id` deal-ticket page

## 41. Bundle Excluded from Feed When Deal Collapses
**Given** a bundle's live (non-deleted, non-sold) members drop below 2
**When** `hydrateBundleCard` runs during feed hydration
**Then** the card returns null and the bundle is dropped from that page of the feed

## 42. "Available as a Bundle" Banner on a Member Ad
**Given** the flag is on and the viewed ad belongs to an ACTIVE standalone bundle
**When** the ad detail page loads (`getBundleBannerForAd`)
**Then** a teal "Available as a bundle" banner shows the other members (current item dimmed, "you're here"), the together price vs separately total, and the savings %

## 43. Navigate from the Banner
**Given** the bundle banner is shown on an ad detail page
**When** the user taps the banner body → `/bundle/:id`; when they tap another member thumbnail → that member's ad (`/ad/:adId`)
**Then** the banner is removed automatically once the bundle is no longer active (partial/sold/cancelled → `getBundleBannerForAd` returns null)

## Lifecycle & invariants

## 44. A Member Ad Is Soft-Deleted
**Given** an ad that belongs to a standalone bundle is soft-deleted
**When** `posts.deleteAd` runs
**Then** `detachAdFromBundle(..., "deleted")` removes it from `adIds`, clears its `bundleId`, and moves the bundle to `partial` — or `cancelled` (freeing survivors) if fewer than 2 remain

## 45. Mutual Exclusivity Is Enforced on Create
**Given** the user tries to bundle an ad already carrying a `bundleId` or `saleEventId`
**When** `createBundle` validates each ad
**Then** it throws ("already in another bundle" / "in a moving sale") — an ad belongs to at most one bundle and is never in both a bundle and a sale

---

### Known gaps (as of this mapping — see repo report)
- **Dashboard "Add to a bundle" CTA omits the trade-only guard.** `UserDashboard.tsx:298` checks `!ad.isSold && !ad.bundleId && !ad.saleEventId` but not `listingType !== "exchange"`, so an exchange ad shows the CTA and preselects into the wizard where it is ineligible/greyed and cannot be deselected (`BundleFlow` `toggle` early-returns for ineligible tiles), leaving the wizard in a dead end that `createBundle` ultimately rejects.
- **Individual "item sold" → `partial` has no production trigger.** `bundles.markBundleItemSold` (and `detachAdFromBundle` "sold" mode) are only exercised in tests; no dashboard UI marks a single bundled ad sold, so in the running app `partial` is reached only via member soft-delete (Journey 44).
- **No-savings bundles are creatable.** The wizard warns (`noSaving`) but does not block; `createBundle`/`updateBundlePrice` only require price > 0.
- **`savedBundles` sync-window race.** During the authenticated-but-not-yet-synced window, saving shows a misleading "Please sign in to save this bundle" toast (`useSaveToggle` gates on `getCurrentUser`, which is null mid-sync).
