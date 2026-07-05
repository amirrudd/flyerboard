---
trigger: always_on
description: Routing and navigation structure
---

# Routing & Navigation

**Last Updated**: 2026-07-05

## Routes (React Router v7)
- **/**: HomePage (Flyers grid)
- **/ad/:id**: AdDetailPage (View flyer, contact seller)
- **/post**: PostAdPage (Create new listing)
- **/edit/:id**: EditAdPage (Edit existing listing)
- **/dashboard**: DashboardPage (User flyers, favorites, settings)
- **/messages**: MessagesPage (User conversations)
- **/admin**: AdminDashboard (Admin-only, user/flyer management)
- **/terms**: TermsPage
- **/community-guidelines**: CommunityGuidelinesPage

## Navigation Components
- **Layout**: Wraps all pages. Handles responsive structure.
- **Header**: Desktop top navigation.
- **Sidebar**: Desktop side navigation (collapsible).
- **BottomNav**: Mobile bottom navigation (visible < 768px).

## Patterns
- **Deep Linking**: /ad/:id for direct access to flyers.
- **Responsive Nav**: Sidebar collapses on mobile; BottomNav appears.
- **Protected Routes**: Dashboard, Messages, Post require authentication.
- **Admin Route**: /admin requires isAdmin flag on user.
- **Lazy Loading**: All routes except HomePage use React.lazy().

## Home feed scroll preservation (mobile bottom-nav)
Switching Home → another bottom-nav tab → back to Home preserves the feed
scroll position; tapping Home while already on Home scrolls to top.

- **Scroll container differs by breakpoint**: on mobile the Layout `<main>`
  (`overflow-y-auto`) scrolls; on desktop the HomePage `adsFeedRef` div
  (`md:overflow-y-auto`) scrolls. Code that touches scroll MUST handle both —
  listen on both, and when restoring, only set `scrollTop` on the element whose
  `scrollHeight > clientHeight` (the inactive one silently ignores it).
- **Persistence**: HomePage saves the active container's `scrollTop` to
  `sessionStorage[HOME_SCROLL_KEY]` on scroll (save on scroll, not on unmount —
  unmount is too late: a route transition can clip `main.scrollTop` before
  cleanup runs). Near-top (`<= 4px`) clears the key so a scroll-to-top's
  trailing smooth-scroll events don't leave a stale offset.
- **Restore is a retry loop, not a single rAF** (load-bearing): the cached feed
  renders at full height immediately on a reload, but on SPA return the content
  can still be settling, and a single `requestAnimationFrame` lands while the
  container is shorter — `scrollTop` clamps low and stays there. Re-apply the
  saved offset every frame until it's reached (within 1px) or a ~1500ms deadline
  passes, and set a `restoring` flag that suppresses saving during the loop so
  clamped intermediate values don't overwrite the real offset.
- **Ignore programmatic focus jumps** (load-bearing): clicking/tabbing to an ad
  card focuses it and the browser's scroll-into-view jumps the shared `<main>`
  right before navigation — which would be saved as the user's place. A focus
  jump is always preceded by a bubbling `focusin`, so suppress saving for ~150ms
  after one. (NB: a real tap on an already-visible card does **not** jump; the
  jump was originally observed only via Puppeteer's click-auto-scroll, but the
  focusin guard covers the genuine keyboard/partially-visible-card case.)
- **Bridge pattern**: `src/lib/homeScrollBridge.ts` is a tiny module-level
  registry exposing `HOME_SCROLL_KEY` plus register/unregister/trigger. HomePage
  registers its `handleScrollToTop` on mount; BottomNav calls
  `triggerHomeScrollToTop()` on Home tap without importing HomePage's refs. This
  reuses HomePage's existing `handleScrollToTop` (the same fn the
  ScrollToTopButton uses, verified to scroll both containers) instead of
  BottomNav guessing the container via `querySelector("main")` — the original
  bug (wrong container on desktop, and brittle). Known follow-up: a
  Layout-level context ref would be more React-idiomatic than a module
  singleton, but BottomNav is a sibling of `<Outlet>` so it can't use the
  existing `useOutletContext` channel directly.
- **Home tab is a `<button>`, not `<Link>`**: needed so the same handler can
  either scroll-to-top (when already on `/`) or `navigate("/")` — avoids
  `<Link>` + `preventDefault` event-ordering ambiguity.

## `/post` back-navigation contract (`location.state.from`)

- **Every navigation to `/post` must pass `state.from`** (the originating
  path) alongside `editingAd` when editing. `PostAdPage.handleBack` routes on
  it: `/dashboard` → back to dashboard; `editingAd && from.startsWith('/ad/')`
  → back to that ad detail (so the seller sees the updated flyer); everything
  else → `/` with `{ forceRefresh: true }` (intentional for *new* posts — the
  poster should land on the feed and see their new flyer).
- **Gotcha (fixed 2026-07-05)**: AdDetail's "Edit Flyer" button passed only
  `{ editingAd }` without `from`, so Back/Cancel/save-complete from the edit
  form dumped the user on the home screen instead of returning to their ad.
  If you add a new edit entry point, pass both keys or the fallback branch
  silently swallows the return path — there's no runtime warning.
- `onBack` is called both on cancel *and* after a successful edit save
  (`PostAd.tsx` calls `onBack()` immediately for edits; new posts route
  through the notification-permission modal first). The returned-to AdDetail
  shows fresh data automatically (reactive Convex query).
- Tests encoding this contract: `src/pages/PostAdPage.test.tsx`
  ("navigate back to the ad detail page when editing from ad detail").

## Ad detail instant-render via `location.state.initialAd`

- **Pattern**: when navigating to `/ad/:id` and the caller already has the ad
  object in scope (feed card, saved-ad card, chat's linked ad, command-palette
  search result), pass it through router state so `AdDetailPage`/`AdDetail`
  can render instantly instead of waiting for `getAdWithContext` to resolve:
  `navigate(\`/ad/${ad._id}\`, { state: { initialAd: ad } })`. `AdDetailPage.tsx`
  reads it as `location.state?.initialAd` and forwards it to
  `<AdDetail initialAd={...} />`, which does `const displayAd = ad || initialAd`.
  **The key must be `initialAd` on both sides** — it was `ad` on the read side
  from Nov 2025 (commit b313bda) until 2026-07-02, silently making the whole
  optimization dead for ~8 months (every navigation, including from the feed,
  fell through to the full skeleton). Fixed in `src/pages/AdDetailPage.tsx`.
- **Call sites that pass `initialAd`** (full object in scope at click time):
  `HomePage.tsx` (`AdsGrid`'s `onAdClick`), `UserDashboard.tsx`
  (`handleViewFlyer(adId, ad)` from the chats tab's linked `chat.ad`),
  `CommandPalette.tsx` (`handleSelectListing(id, listing)` from search
  results). All three now pass `{ state: { initialAd } }` conditionally (only
  when the object is available) so the signature stays backward compatible.
- **Call sites deliberately left without it**: the dashboard's "Saved" tab
  and "My Ads" tab don't navigate to `/ad/:id` at all — they set
  `selectedAdId` and render `<AdDetail adId={selectedAdId} />` inline (no
  `initialAd` prop passed there either; not this pattern's concern). Moving
  Sale pages don't link to individual `/ad/:id` routes.
- **`initialAd` is partial/feed-shaped, not the full query shape** — guard any
  field only present on `getAdWithContext`'s result (e.g. `adCategory` is
  still computed from `ad?.categoryId`, the live query, not
  `displayAd?.categoryId`, so the category breadcrumb intentionally still
  waits for the query even when `initialAd` renders the rest instantly).
  Never assume `displayAd` has seller ratings, save-state, or chat context —
  those only exist once the real `ad` object replaces `initialAd`.

## Ad detail breadcrumb — zero-CLS pattern

- `AdDetail.tsx`'s `<nav aria-label="Breadcrumb">` (~line 441) is now
  **unconditionally rendered** in both the `!displayAd` skeleton branch and
  the loaded branch, at the same height, so there's no vertical layout shift
  between them. Title crumb: `displayAd?.title` when present, else a
  `shimmer bg-muted rounded h-3 w-16` placeholder sized like the text. The
  category crumb (`adCategory && ...`) is still conditional — that only
  changes *width*, not height, which is acceptable per the project's CLS bar
  (only vertical shift matters).
  - Previously the whole `<nav>` was wrapped in `{displayAd && ...}`, so on a
    cold load (no `initialAd`) it popped in only after `getAdWithContext`
    resolved, pushing the image gallery down. Fixed by adding a matching
    breadcrumb skeleton to the `!displayAd` loading branch too, not just
    removing the conditional in the loaded branch.
