# Dashboard Feature - User Journeys

This document captures all user journeys and flows for the User Dashboard feature package
(`src/features/dashboard/`, entered via `src/pages/DashboardPage.tsx`).

> Source of truth: `UserDashboard.tsx`, `BundlesTab.tsx`, `MovingSalesTab.tsx`, and the
> backing Convex queries/mutations (`convex/posts.ts`, `convex/descopeAuth.ts`,
> `convex/adDetail.ts`, `convex/bundles.ts`, `convex/saleEvents.ts`, `convex/users.ts`).
> Verified Jul 2026. Chats/messages moved OFF the dashboard to the `/messages` route
> (mobile chat redesign) — the dashboard keeps only a pointer link + unread badge.

## Access & routing

### 1. Access Dashboard (Authenticated)
**Given** the user is authenticated (`useSession().isAuthenticated`, not `isSessionLoading`)
**When** they navigate to `/dashboard`
**Then** `DashboardPage` mounts `UserDashboard`, showing the profile summary sidebar and the
My Flyers / Saved / (Moving sales) / (Bundles) / Profile tabs. A "Messages" sidebar entry is a
link to `/messages`, not a tab.

### 2. Access Dashboard (Unauthenticated)
**Given** the user is not authenticated
**When** they navigate to `/dashboard`
**Then** `DashboardPage` redirects to `/` (`navigate('/', { replace: true })`) and renders
`PageLoader` in the meantime. (The `UserDashboard` "Please sign in" fallback is effectively
unreachable through the route because the page-level redirect fires first.)

### 3. Legacy chats-tab URL redirect
**Given** an old link of the form `/dashboard?tab=chats` (or archived-chats variant)
**When** the user opens it
**Then** `getLegacyChatsRedirect` maps it to the new `/messages` destination and `DashboardPage`
redirects (`replace: true`) before `UserDashboard` mounts. Signed-out users hit the `/` auth
redirect instead (the auth guard effect is declared last and wins).

### 4. Deep link to / switch tabs via URL
**Given** a dashboard URL with `?tab=<ads|saved|sales|bundles|profile>`
**When** the user navigates to it or switches tabs in the UI
**Then** `parseDashboardTab` selects the tab; unknown/legacy values fall back to `ads`. Tab
switches write `?tab=` with `replace: true`. Inline `?ad=` / `?messages=` view params are
URL-derived, so a tab switch that rewrites params implicitly closes any open inline view.

### 5. Flag-gated tab bounce
**Given** a bookmarked `?tab=sales` (or `?tab=bundles`) link but the `movingSaleMode`
(resp. `bundleListing`) flag is OFF
**When** the dashboard loads on that tab
**Then** an effect pushes `?tab=ads` (URL-only write; the URL→activeTab sync effect is the sole
writer of `activeTab`, avoiding the documented infinite effect ping-pong). The sidebar entry for
that tab is also hidden.

## My Flyers tab

### 6. View My Flyers
**Given** the user is on the `ads` tab
**When** the tab renders
**Then** `api.posts.getUserAds` runs (gated only on `activeTab === "ads"`) and returns the user's
**non-deleted** ads (`.filter(isDeleted !== true)`), active and inactive alike. Deleted ads are
NOT returned — the dashboard has no deleted-ads view. Loading shows `AdListingSkeleton` x3.

### 7. Empty Flyers state
**Given** the user has no (non-deleted) flyers
**When** they view My Flyers
**Then** they see "No Flyers Yet" with a "Pin Your First Flyer" button that calls `onPostAd`
(→ `/post`).

### 8. Post a flyer from the dashboard
**Given** the user is on My Flyers
**When** they click "Pin Next Flyer" (header) or "Pin Your First Flyer" (empty state)
**Then** `onPostAd` navigates to `/post` with `state.from = '/dashboard'`.

### 9. Profile-summary statistics
**Given** the user has data
**When** the sidebar profile card renders
**Then** `api.descopeAuth.getCurrentUserWithStats` supplies `totalAds`, `totalViews`,
`averageRating`, `ratingCount` (all animated via `CountUp`). Stats **exclude soft-deleted ads**
(`.filter(isDeleted !== true)` in the backend). Skeleton shown until `convexUser && userStats`.

### 10. Per-card views + active/inactive badge
**Given** the My Flyers list is loaded
**When** each `MyAdCard` renders
**Then** it shows the ad image, title, price (with strike-through `previousPrice` when higher),
view count, and an Active/Inactive pill.

### 11. Edit a flyer
**Given** the user is viewing their flyers
**When** they click the card body or its "Edit" button
**Then** `onEditAd(ad)` navigates to `/post` with `state.editingAd = ad`, `from = '/dashboard'`
(the edit form is where deletion also lives — see #14).

### 12. Toggle active status
**Given** the user owns a flyer
**When** they click "Activate"/"Deactivate"
**Then** `api.posts.toggleAdStatus` flips `isActive` (server verifies auth + ownership) and a
success/error toast shows. Convex reactivity re-renders the badge.

### 13. Open a flyer's messages
**Given** the user owns a flyer
**When** they click "Messages" on the card
**Then** `navigate('/messages?flyer=<adId>')`. A red unread badge on the button reflects
`api.messages.getUnreadCounts` (gated on `activeTab === "ads" && userAds`). Convex reactivity
updates it live.

### 14. Delete a flyer — NOT wired from the dashboard (see BROKEN)
**Given** the delete-confirm modal + `handleDeleteAd` (→ `api.posts.deleteAd`, soft-delete
stamping `isDeleted/isActive/deletedAt` and detaching from any bundle) exist in `UserDashboard`
**When** the user is on My Flyers
**Then** there is **no control that opens the modal** — `MyAdCard` renders Boost / Messages /
Toggle / Edit only, no delete button, and `setShowDeleteConfirm(<id>)` is never called. The
modal and handler are orphaned; deletion is reachable only from the edit form at `/post`.
(Backend `deleteAd` itself is correct and enforces ownership.)

## Boost to top (flag: `boostToTop`)

### 15. Boost a Flyer (eligible)
**Given** `boostToTop` is on, and the user owns an active, unsold, un-bundled, non-sale flyer
whose cooldown has elapsed
**When** they click "Boost to top" and confirm in `BoostConfirmModal`
**Then** `api.posts.boostAd` re-stamps `bumpedAt` (jumps to top of the shared feed) and increments
`boostCount`; the launch FX play (card lift, ring pulse, floating arrow), a success toast shows,
and the button settles into the disabled "Boost in {N}d" countdown. Server enforces flag +
ownership + eligibility + cooldown + per-user daily cap (all fail-closed).

### 16. Boost during cooldown
**Given** the user owns a flyer boosted/created less than the cooldown ago
**When** they view it on the dashboard (or detail page)
**Then** a disabled "Boost in Xd" ("Boost in Xh" in the final day) button shows; the countdown
recomputes live if an admin changes the cooldown; a raced/rejected boost surfaces the server error
toast with NO celebration FX.

### 17. Boost ineligible by state or flag
**Given** a flyer is sold, inactive, in a bundle or a Moving Sale — or `boostToTop` is off
**When** the owner views it
**Then** no Boost control renders at all (`boost.state === "ineligible"` or `!boostEnabled`); the
server also rejects `boostAd` for each state.

## Bundles integration on My Flyers (flag: `bundleListing`)

### 18. "Bundle ads" entry + In-bundle tag
**Given** `bundleListing` is on
**When** My Flyers renders
**Then** a "Bundle ads" header button navigates to `/sell/bundle`. `api.bundles.getMyBundles`
(gated on `ads` tab + flag) builds an adId→bundle map; a card already in a bundle shows an
"In bundle: {label}" pill that opens `BundleManageModal`.

### 19. Add a flyer to a bundle
**Given** a flyer that is unsold, not already bundled, and not in a sale
**When** the owner clicks its "Add to a bundle" pill
**Then** `navigate('/sell/bundle?preselect=<adId>')`.

## Moving Sale entry (flag: `movingSaleMode`)

### 20. Moving-sale promo banner
**Given** `movingSaleMode` is on
**When** My Flyers renders
**Then** a "Moving house? Run a moving sale" banner navigates to `/sell/moving-sale`.

## Saved tab

### 21. View Saved Ads
**Given** the user is on the `saved` tab
**When** it renders
**Then** `api.adDetail.getSavedAds` (gated on `saved` tab) lists saved ads (skeleton while
undefined; "No saved ads" empty state). Rows with a null `ad` (deleted target) are filtered out.
Clicking a row opens `AdDetail` inline via `?ad=<id>`.

### 22. Saved Sales / Saved Bundles groups
**Given** the relevant flag is on and the user saved sales/bundles
**When** the Saved tab renders
**Then** `api.saleEvents.getSavedSaleEvents` / `api.bundles.getSavedBundles` (each gated on tab +
flag) render "Saved Sales" and "Saved Bundles" group rows above Saved Ads; clicking navigates to
`/sale/<slug>` or `/bundle/<id>` ("no longer available" suffix for a partial bundle).

### 23. Remove from Saved — happens in AdDetail, not the Saved tab
**Given** the Saved tab lists saved ads
**When** the user wants to unsave one
**Then** there is no unsave control in the Saved tab itself; they open the ad (`AdDetail`) and
toggle save there. The list re-renders reactively once unsaved.

## Moving sales tab (flag: `movingSaleMode`)

### 24. View / manage my moving sales
**Given** the `sales` tab is active and `movingSaleMode` is on
**When** it renders
**Then** `MovingSalesTab` runs `api.saleEvents.getMySaleEvents` (skeleton / "no sales" empty state
with a "Start a moving sale" CTA → `/sell/moving-sale`). Each sale row links to `/sale/<slug>`
(view) and `/sell/moving-sale?sale=<id>` (edit).

## Bundles tab (flag: `bundleListing`)

### 25. View / manage my bundles
**Given** the `bundles` tab is active and `bundleListing` is on
**When** it renders
**Then** `BundlesTab` runs `api.bundles.getMyBundles` (skeleton / empty state with a "Create a
bundle" CTA → `/sell/bundle`). A bundle row opens `BundleManageModal` (edit price / remove items /
etc.).

## Profile tab

### 26. Edit name & email (validated)
**Given** the user is on the Profile tab
**When** they change Name/Email and submit
**Then** client validation runs (name 2–15 chars, letters/space/hyphen/apostrophe; email optional,
≤50 chars, regex + local-part length, 500 ms debounced live error). On pass,
`api.users.updateProfile` saves; toast on success/error. If the Convex user hasn't synced yet
(`_id === "temp-id"`) submit is blocked with "Please wait for profile sync to complete".

### 27. Upload profile picture
**Given** the user is on Profile (or clicks the sidebar avatar)
**When** they pick an image
**Then** `generateProfileUploadUrl` → `uploadImageToR2` (compression + progress) →
`updateProfile({ image: key })`; spinner during upload, success/error toast, input reset.

### 28. Email-collection banner
**Given** the synced user has no email
**When** any tab renders
**Then** a "Get notified when buyers message you" banner shows on all tabs with an "Add email
address" button that jumps to the Profile tab.

### 29. Identity verification (flag: `identityVerification`)
**Given** `api.featureFlags.getFeatureFlag('identityVerification')` is enabled
**When** Profile renders
**Then** a verification card shows current status; an unverified user gets a "Verify Identity"
button calling `api.users.verifyIdentity` (toast on success/error). Verified users show a badge in
the sidebar and on their flyers.

### 30. Email notification toggle
**Given** the synced user has an email
**When** they toggle "Email notifications for new messages"
**Then** `api.users.updateEmailNotificationPreference({ enabled })` saves; toast on success/error.
(No email → the toggle is not rendered; the collection banner shows instead.)

### 31. Browser (push) notifications card
**Given** the browser supports push (`usePushNotifications().isSupported`)
**When** Profile renders `BrowserNotificationsCard`
**Then** the user can Enable (subscribe) / toggle off (unsubscribe); "Blocked in browser" state
when permission is denied. Mount-time service-worker/pushManager work runs only when this card
renders (own component).

### 32. Delete account (Danger Zone)
**Given** the user is on Profile
**When** they click "Delete Account" and confirm in the modal
**Then** `api.users.deleteAccount` runs; on success a toast shows and `onBack()` leaves the
dashboard. Permanently removes their data (ads, messages, saved items).

## Chrome / navigation

### 33. Persistent header (back / title / sign-out / theme)
**Given** the dashboard is open (not on the inline AdMessages or "please sign in" screens)
**When** it renders
**Then** `useHeaderSlots` registers a back button (on mobile off the `ads` tab it first returns to
`ads`; otherwise `onBack()`), title, `ThemeToggle`, and `SignOutButton` (icon-only on mobile). The
inline `AdDetail` stacks its own header on top while open.

### 34. Sign out
**Given** the user is on the dashboard
**When** they click Sign Out
**Then** `SignOutButton` signs out (Descope) and `onSignOut` = `onBack()` returns to `/`.

### 35. Messages pointer link + unread badge
**Given** the desktop sidebar
**When** it renders
**Then** the "Messages" entry navigates to `/messages` (not a tab) and shows a live total-unread
badge from `useTotalUnreadCount()`.

### 36. Desktop sidebar navigation
**Given** desktop (`md:` and up)
**When** the sidebar renders
**Then** a sticky vertical nav lists the tabs (Messages as a link); the active tab is highlighted;
clicking sets the tab, writes `?tab=`, and flags scroll-to-content.

### 37. Mobile tab navigation
**Given** mobile
**When** the dashboard renders
**Then** the desktop sidebar is hidden (`hidden md:block`); tab switching comes from the global
Layout bottom nav / URL `?tab=` and the profile-edit pencil. On a manual tab change the content
section auto-scrolls into view (`shouldScrollToContent`), guarded against racing the back-button
scroll-to-top intent.

### 38. Inline drill-in views (legacy deep links)
**Given** a URL with `?ad=<id>` or `?messages=<id>`
**When** the dashboard mounts
**Then** it renders `AdDetail` (resp. `AdMessages`) full-screen; back clears the param. Newer flows
navigate to `/messages?flyer=<adId>` instead of using `?messages=`.

### 39. Reactive refresh
**Given** the user posts/edits/toggles/boosts a flyer or saves an item
**When** the underlying Convex data changes
**Then** the dashboard updates automatically via Convex query reactivity (no manual refetch).

### 40. Loading & error states
**Given** data is fetching or a mutation fails
**When** it resolves
**Then** skeletons cover loading (`UserProfileSkeleton`, `AdListingSkeleton`, `SavedAdSkeleton`);
mutation failures surface a `sonner` toast with the server error message.
