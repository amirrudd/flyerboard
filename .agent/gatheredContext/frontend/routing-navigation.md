---
trigger: always_on
description: Routing and navigation structure
---

# Routing & Navigation

**Last Updated**: 2026-06-29

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
