# Layout / Navigation & Static Pages — User Journeys

Given/When/Then flows for the app shell (header, mobile nav, footer links, auth
modal, providers, loading gate, routing + error boundaries) **and** the
static/content pages (blog, terms, community guidelines, support, about, 404)
plus PWA behaviour.

Grounded in code as of 2026-07-19. Key files: `src/App.tsx`,
`src/features/layout/{Layout,Header,HeaderSlots,HeaderRightActions,BottomNav}.tsx`,
`src/features/layout/Sidebar/*`, `src/pages/{Blog*,Terms,CommunityGuidelines,Support,AboutUs,NotFound}Page.tsx`,
`middleware.ts`, `public/{manifest.json,sw.js}`, `src/main.tsx`.

> **Load-bearing architecture note.** There is ONE persistent `<Header>` instance
> for every route under `<Layout>` (`Layout.tsx:84`). Pages customise it by
> registering `leftNode`/`centerNode`/`rightNode` through `useHeaderSlots(...)`
> (`HeaderSlots.tsx`). A page that registers nothing gets the **default header**
> (logo + location + search + ThemeToggle + Pin/Sign-In actions). In practice
> only `HomePage` uses the default header; every other page (blog, static, ad
> detail, dashboard, messages, public sale/bundle) registers a Back-button slot.
> The **Sidebar is NOT part of the Layout shell** — it is mounted by
> `HomePage.tsx:322` only. So the header hamburger and the category sidebar are
> effectively a home-page feature (see "Sidebar" section).

---

## Header (persistent shell)

### 1. Persistent header across navigation
**Given** the user navigates between routes under `<Layout>`
**When** the route changes (including lazy-chunk loads)
**Then** the single `<Header>` instance stays mounted — logo/actions do not
flash or re-mount (`Layout.tsx` `PersistentHeader` + `useSyncExternalStore`).

### 2. Default header content (desktop)
**Given** the user is on a page that registers no header slots (e.g. Home)
**When** the desktop header renders
**Then** they see: FlyerBoard logo + wordmark (left), location selector, a
centered search bar, and on the right ThemeToggle + "Pin Your Flyer" + "Sign In"
or "My Dashboard" (`Header.tsx:447`, `HeaderRightActions.tsx`).

### 3. Click logo → Home
**Given** the user is viewing the default header
**When** they click the logo/wordmark
**Then** `navigate('/')` is called (`Header.tsx:459`; mobile `:352`).

### 4. Search flyers (desktop)
**Given** the default header is shown
**When** the user types in the search bar
**Then** the query is pushed to `MarketplaceContext` via a 500ms-debounced
handler; if not already on `/`, the app navigates to `/` so results show
(`Header.tsx:438`).

### 5. Search flyers (mobile, expandable)
**Given** the user is on mobile with the default header
**When** they tap the magnifier icon
**Then** an expandable search overlay opens, auto-focuses, and closes on
outside click; typing debounces (500ms) into `MarketplaceContext` and navigates
to `/` when non-empty (`Header.tsx:MobileHeader`).

### 6. Header title swaps to "My dashboard" on dashboard (mobile)
**Given** the user is on `/dashboard` on mobile with the default header
**When** the mobile header renders
**Then** the wordmark reads "My dashboard" and the right side shows a
`SignOutButton` (icon only) instead of location + search (`Header.tsx:357,364`).

### 7. Select / detect location
**Given** the user opens the location selector
**When** they type a suburb/postcode (≥2 chars, 300ms debounce) or tap "Detect
my location"
**Then** matching AU localities appear (or geolocation → Nominatim reverse
geocode resolves one), and the choice updates `selectedLocation` in
`MarketplaceContext`; "All Locations" clears it (`Header.tsx:LocationSelector`).
Opening the dropdown prefetches the ~1.9MB postcode dataset.

### 8. ThemeToggle
**Given** the header is shown
**When** the user clicks the theme toggle
**Then** light/dark theme switches (`ThemeToggle`, present in both default and
most custom `rightNode`s).

### 9. Post CTA — "Pin Your Flyer"
**Given** the user clicks "Pin Your Flyer" (desktop header)
**When** they are authenticated
**Then** `navigate('/post', { state: { from } })`; **when unauthenticated**, the
auth modal opens (`Header.tsx:504`).

### 10. Sign In / My Dashboard action
**Given** the default header right actions render
**When** the user is authenticated → "My Dashboard" → `navigate('/dashboard')`;
**when** unauthenticated → "Sign In" → opens the auth modal
(`HeaderRightActions.tsx`, `Header.tsx:511`).

### 11. Custom header slots per page
**Given** a non-home page mounts (blog/static/ad/dashboard/messages)
**When** it calls `useHeaderSlots({ leftNode, centerNode, rightNode })`
**Then** the persistent header renders that page's Back button + title instead of
the default; the previous registrant (or default) is restored on unmount. Config
is rebuilt every render (no memoization) so slot JSX never goes stale
(`HeaderSlots.tsx`).

### 12. Hidden header
**Given** a full-screen sub-view registers `{ hidden: true }`
**When** its slots are active
**Then** `PersistentHeader` returns `null` (`Layout.tsx:42`) — reserved for views
that never had a header (e.g. dashboard's AdMessages).

---

## Command palette

### 13. Open command palette (Cmd/Ctrl+K)
**Given** the user is anywhere under `<Layout>`
**When** they press ⌘K / Ctrl+K
**Then** the `CommandPalette` overlay toggles open (global keydown listener in
`Layout.tsx:69`); it closes via its own `onClose`.

---

## Sidebar (home-page category nav)

> The Sidebar is rendered by `HomePage`, not `Layout` (`HomePage.tsx:322`,
> `Sidebar/index.tsx`). The header's mobile hamburger toggles
> `sidebarCollapsed` in `MarketplaceContext`; that state only has a visible
> effect on Home where the Sidebar is mounted.

### 14. Toggle sidebar (mobile hamburger)
**Given** the user is on Home on mobile with the default header
**When** they tap the List/hamburger icon
**Then** `sidebarCollapsed` flips; `MobileSidebar` renders as a portal overlay
with scroll lock (`Header.tsx:343`, `Sidebar/index.tsx:31`).

### 15. Toggle sidebar (desktop)
**Given** the user is on Home on desktop
**When** the sidebar is not collapsed
**Then** `DesktopSidebar` renders sticky with the category list; when collapsed it
renders `null` (`Sidebar/index.tsx:36`).

### 16. Select category / view all
**Given** the sidebar is open
**When** the user clicks a category (or clears)
**Then** `selectedCategory` updates and the home feed filters; icons render per
category (`SidebarContent.tsx`).

### 17. Sidebar footer links
**Given** the sidebar is open
**When** the user views its fixed footer
**Then** they see links to About Us, Blog, Support, Terms, Privacy
(`/terms#privacy`), Guidelines, Contact (`/support`), plus "© 2026 FlyerBoard"
(`SidebarContent.tsx:112`). **This footer is the app's only persistent
site-nav-to-static-pages surface** (there is no global `<footer>` in Layout).

---

## Bottom navigation (mobile)

### 18. View bottom nav
**Given** the user is on mobile
**When** they view a page under `<Layout>`
**Then** a fixed 5-item bottom bar shows: Home, Saved, PIN (prominent center
FAB), Messages, Dashboard/Sign In (`BottomNav.tsx`). Hidden on `md+`.

### 19. Bottom nav hidden on blog and full-screen chat
**Given** the path starts with `/blog`, or is a `/messages/:chatId` conversation
(but not `/messages` or `/messages/archived`)
**When** the bottom nav evaluates
**Then** it returns `null` (`BottomNav.tsx:23,33`).

### 20. Home tab — tap-to-top
**Given** the user is already on `/`
**When** they tap Home
**Then** it triggers a scroll-to-top of the feed instead of navigating
(`BottomNav.tsx:56`, `homeScrollBridge`).

### 21. Auth-guarded tabs
**Given** the user is unauthenticated
**When** they tap Saved / PIN / Messages / Dashboard
**Then** the auth modal opens instead of navigating; the Dashboard item also
relabels to "Sign In" with a User icon (`BottomNav.tsx:48,127`).

### 22. Authenticated tab navigation
**Given** the user is authenticated
**When** they tap Saved → `/dashboard?tab=saved`, PIN → `/post`, Messages →
`/messages`, Dashboard → `/dashboard?tab=ads`
**Then** they navigate there; the active item shows a dot + bold icon
(`BottomNav.tsx:isActive`).

### 23. Unread badge on Messages
**Given** the user has unread messages
**When** the bottom nav renders
**Then** an `UnreadBadge` overlays the Messages icon (0 while signed out;
`BottomNav.tsx:20,119`).

---

## Layout shell, providers & auth modal

### 24. Provider order & session loading gate
**Given** the app boots
**When** `useSession().isSessionLoading` is true
**Then** `App` short-circuits to a full-screen `<PageLoader />` — **the whole app
(including public static/blog pages) waits on the Descope session resolving**
(`App.tsx:37`). Providers wrap outer→inner: `ErrorBoundary` → `UserSyncProvider`
→ `MarketplaceProvider` → `LazyMotion` → `BrowserRouter` (`App.tsx:42`).

### 25. Global auth modal
**Given** any shell surface calls `setShowAuthModal(true)` (header, bottom nav,
or a page via `Outlet` context)
**When** `showAuthModal` is true
**Then** a single OTP sign-in modal renders from `Layout` — role="dialog",
aria-modal, backdrop-click and X close **only when dismissable**; the
`SmsOtpSignIn` step can lock dismissal via `onDismissableChange`
(`Layout.tsx:93`). This is the ONE canonical auth modal; pages should use the
`Outlet` context `setShowAuthModal`, not a second local modal.

### 26. Sticky header / bottom nav & safe areas
**Given** the user scrolls on mobile
**When** content exceeds the viewport
**Then** only `<main>` scrolls; the header is `sticky top-0` inside the scroller
and the bottom nav is `fixed` with `env(safe-area-inset-bottom)` padding; the
shell uses `h-dynamic-screen` + `pt-safe` (`Layout.tsx:81`, `BottomNav.tsx:76`).

---

## Routing & error boundaries

### 27. Lazy routes with per-route Suspense + ErrorBoundary
**Given** the user navigates to any route except Home
**When** the route element mounts
**Then** it is individually wrapped in `<ErrorBoundary><Suspense fallback=
{<PageLoader/>}>…` so a failed chunk load or render error is isolated to that
route and shows the boundary fallback (`App.tsx:71`–`173`). Home is **eager and
NOT individually wrapped** — it relies only on the app-level `ErrorBoundary`
(`App.tsx:68`).

### 28. Catch-all 404 inside the shell
**Given** the user hits an unknown URL
**When** the router matches `path="*"`
**Then** `NotFoundPage` renders inside `<Layout>` (keeps header + bottom nav),
wrapped in its own ErrorBoundary/Suspense (`App.tsx:167`).

### 29. Immersive seller routes render OUTSIDE the shell
**Given** the user opens `/sell/moving-sale` or `/sell/bundle`
**When** the route matches
**Then** the page renders full-screen with its own ErrorBoundary/Suspense but
**outside** `<Layout>` — no persistent header, sidebar, or bottom nav
(`App.tsx:52,59`). (Out of nav scope; noted for routing completeness.)

---

## Static / content pages

Each static page: scrolls to top on mount (Terms/Guidelines also handle a
`#hash` smooth-scroll), and registers a header slot with a Back button
(`navigate('/')`) + a page title in `centerNode` and an empty `rightNode`.

### 30. Terms & Privacy
**Given** the user opens `/terms` (optionally `#privacy`)
**When** the page renders
**Then** it shows Terms + Privacy markdown (`terms-and-conditions.md` +
`privacy-policy.md` via `?raw`) under a "Terms & Privacy" header; a `#hash`
smooth-scrolls to that section (`TermsPage.tsx`).

### 31. Community Guidelines
**Given** the user opens `/community-guidelines`
**When** the page renders
**Then** it shows `community-guidelines.md` under a "Community Guidelines"
header, with `#hash` smooth-scroll support (`CommunityGuidelinesPage.tsx`).

### 32. About Us
**Given** the user opens `/about`
**When** the page renders
**Then** it shows an editorial hero + `about-us.md` under an "About Us" header
(`AboutUsPage.tsx`). ⚠️ The hero image is loaded from an **external
Wikimedia URL** (`upload.wikimedia.org`), not a self-hosted/CDN asset.

### 33. Support — contact form
**Given** the user opens `/support`
**When** they fill name/email/title/body and submit
**Then** a success toast fires and the form resets — **but the submission is a
stub**: it only `logDebug`s and never sends to any backend
(`SupportPage.tsx:22`). The page also has its own in-content footer linking to
Guidelines / Terms / Privacy.

---

## Blog

### 34. Blog index
**Given** the user opens `/blog`
**When** the page renders
**Then** it lists all posts newest-first as cards (`getAllPosts()`), with a
Back-to-FlyerBoard header slot + ThemeToggle, an empty-state ("No posts yet"),
and emits `<title>`/`<meta>`/canonical/OG + `Blog` JSON-LD (ItemList of posts)
directly in JSX (React 19 head hoisting) (`BlogIndexPage.tsx`).

### 35. Blog post
**Given** the user opens `/blog/:slug` for an existing post
**When** the page renders
**Then** it shows hero image, category/author/date/reading-time meta, markdown
body, up to 2 "Keep reading" related posts, and CTAs (All posts, Post an ad). It
emits `BlogPosting` JSON-LD + FAQ JSON-LD (when the post has a FAQ section)
(`BlogPostPage.tsx`).

### 36. Blog back-navigation state
**Given** the user arrived at a post from within `/blog`
**When** they tap Back
**Then** it returns to `/blog` (label "Blog"); a direct/external entry (no
`state.from`) falls back to `/` (label "FlyerBoard") (`BlogPostPage.tsx:24`).

### 37. Blog post not found (in-page, not the 404 route)
**Given** the slug matches no post
**When** the page renders
**Then** `BlogPostPage` shows its own "Post not found" panel with a link back to
`/blog` (it does NOT hit the `*` route, since `/blog/:slug` matched)
(`BlogPostPage.tsx:63`).

### 38. Social share cards (OG) — server-injected for crawlers
**Given** a crawler/scraper requests `/blog/:slug`
**When** `middleware.ts` intercepts it (matcher includes `/blog/:slug`)
**Then** it injects real per-post `og:*` tags — title/description from
`blog-meta.json` and a per-post `og:image` (`/blog-og/<slug>.png`, built by
`scripts/generate-og-assets.ts`, re-encoded via Cloudflare Transformations)
(`middleware.ts:111,133`).
⚠️ **Client-side, `BlogPostPage.tsx:128` hardcodes `og:image = /og-preview.png`**
(the generic brand card). This is intentional — the real per-post card comes
from the middleware — but any preview path that bypasses the middleware gets the
generic image. Posts with a non-SVG/external `heroImage` fall back to the brand
card even in the middleware path.

---

## PWA

### 39. Installability
**Given** the user visits on a supported browser
**When** the browser evaluates PWA criteria
**Then** the app is installable via the browser's own "Add to Home Screen" /
install affordance — there is **no custom `beforeinstallprompt` handler or
in-app install prompt UI**; install is 100% browser-driven (`public/manifest.json`,
`index.html` meta). `manifest.json` `theme_color` is `#ea580c` (orange) —
diverges from the current brand primary `#dc3626`.

### 40. Service worker — no offline
**Given** the app loads
**When** `main.tsx` registers `/sw.js` on window load
**Then** the SW handles install/activate + push + notificationclick but has
**no fetch handler** — every request goes to network (real-time by design; no
offline mode, no asset caching) (`public/sw.js:14`, `main.tsx:45`).

### 41. Push notifications
**Given** the user (iOS 16.4+ must have installed the PWA) has granted
permission
**When** a push arrives
**Then** the SW `push` handler shows a notification (ad title, not message
body); `notificationclick` opens the app to the relevant chat (`public/sw.js`,
`webPushService.ts`).

### 42. Standalone launch
**Given** the app was added to the home screen
**When** launched from the icon
**Then** it opens in `display: standalone` (no browser chrome), themed status
bar (`manifest.json`).
