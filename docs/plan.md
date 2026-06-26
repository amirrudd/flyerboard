# FlyerBoard Design — Phase 2 Plan

## Where we are

The `design/premium-redesign` branch landed a full editorial-style pass
across every page: warm cream + Fraunces + tinted shadows, kicker labels,
pill buttons and inputs, ring + shadow-card surfaces, motion-staggered
listing grid, branded 404 + Access Denied, and a dark-mode contrast fix
that pushed `text-primary` from 2.86:1 → 5.89:1 against the dark
background.

**System layer is done.** What remains is the *composition / motion /
texture* layer — the difference between "good redesign" and "feels like
a premium brand product."

This document captures the next six work clusters so a different session
can pick up the work cold. Each cluster has: scope, file targets,
acceptance criteria, suggested skills, and rough effort.

---

## Quick reference — shared design contract

These tokens are already wired in `src/index.css` + `tailwind.config.js`
and should be used in any new work without redefining:

| Concept | Token / class | Notes |
|---|---|---|
| Surface | `bg-card ring-1 ring-border/70 rounded-2xl shadow-card` | Use everywhere cards are surfaces |
| Primary CTA | `bg-primary text-primary-foreground h-11 px-4 rounded-full hover:bg-primary/90 active:scale-[0.98] shadow-sm shadow-primary/25` | Pill, brand red, dark or light mode |
| Ghost | `bg-muted/40 text-foreground ring-1 ring-border hover:bg-muted/70 rounded-full` | Secondary actions |
| Outline | `bg-transparent text-primary ring-1 ring-primary/40 hover:ring-primary rounded-full` | Tertiary CTA |
| Input | `h-11 px-4 bg-muted/50 rounded-full ring-1 ring-transparent focus:ring-ring focus:bg-card` | Pill input |
| Section label | `.kicker` (11px small caps tracked uppercase) | In-card section heads |
| Numeric | `.tabular` | Prices, counts, dates |
| Divider | `.hairline` | 1px warm border |
| Hero heading | `font-display tracking-[-0.02em] leading-[1.05]` | Fraunces serif |

**Don't add new tokens; reuse these.**

---

## Phase 1 — Composition variety  *(highest visual ROI)*

The skills' biggest "AI-default" callout is "three equal cards as a
feature row." Our home grid is still a rigid `grid-cols-2/3/4/5/6` —
visually clean but template-y.

### 1.1 Featured listing card on Home

A single hero card spanning **2 columns** (and roughly 1.5× the height)
on the home grid when no category is selected. Larger title in
`font-display`, larger image, optional "FEATURED" kicker chip.

**Files**
- `src/features/ads/AdsGrid.tsx` — special-case `index === 0` when
  `selectedCategory == null`. Add a `featured` prop to the card render
  branch.
- `src/components/ui/SkeletonCard.tsx` — accept a `featured` prop so the
  skeleton shape matches.

**Acceptance**
- Featured card spans 2 cols at `lg:` and up; falls back to normal on
  `sm:` and `md:`.
- Image aspect ratio 16:9 or 3:2 on featured; 4:3 on standard.
- `font-display text-2xl sm:text-3xl` title vs current `text-[15px]`.
- Test suite still passes (`AdsGrid.test.tsx` checks string content, not
  layout — should be fine).
- DOM audit still shows 1 `<h1>` per page (the featured card title
  remains `<h3>` like normal listings — it's a card title, not the page
  heading).

**Effort**: ~2 hours.

### 1.2 Bento on Home for logged-in users

When the user is signed in, lead with: recently viewed (horizontal
scroll row) → category quick-links (2×3 grid of icon tiles) → main feed.
Each block uses kicker labels.

**Files**
- `src/pages/HomePage.tsx` — add the two blocks above `<AdsGrid />`,
  gated on `isAuthenticated`.
- New: `src/features/ads/RecentlyViewedRow.tsx` (reads from localStorage,
  no Convex query needed).

**Effort**: ~3 hours.

### 1.3 Editorial hero on About

Currently just the app icon at top of body. Replace with a 2-column
hero: founder photo / brand story image on one side, narrative h1 +
kicker + body on the other. Picsum placeholder if no real asset.

**File**
- `src/pages/AboutUsPage.tsx`

**Effort**: ~1 hour.

**Skill to reach for**: `high-end-visual-design` or
`design-taste-frontend` for the featured-card direction.

---

## Phase 2 — Motion & micro-interactions

`framer-motion` is installed and used only on the AdsGrid entry
stagger. The skills call out scroll-driven reveals, spring physics, and
spotlight borders as the highest-leverage premium signals.

### 2.1 Honor `prefers-reduced-motion` *(do this first)*

Currently we don't. Wrap all `motion.X` calls in a hook that returns
`null` animation params when the user has reduced motion enabled.

**Files**
- New: `src/hooks/useMotionPrefs.ts` — wraps framer-motion's
  `useReducedMotion`, returns either the staggered config or a
  `{ duration: 0 }` no-op.
- `src/features/ads/AdsGrid.tsx` — replace the inline stagger constants
  with calls into the hook.

**Acceptance**: with `prefers-reduced-motion: reduce`, no cards animate;
contrast/motion audit clean.

**Effort**: ~30 min.

### 2.2 Scroll-triggered reveals on long pages

Use `motion.div` with `whileInView` + `viewport={{ once: true }}` on:
- AdDetail sections (image gallery → title → description → seller card)
- About / Terms / Community sections
- Dashboard top profile + first card

**Files**: `src/features/ads/AdDetail.tsx`,
`src/pages/AboutUsPage.tsx`, `src/pages/TermsPage.tsx`,
`src/pages/CommunityGuidelinesPage.tsx`,
`src/features/dashboard/UserDashboard.tsx`.

**Acceptance**: each top-level section fades up (y: 12 → 0, 400ms,
ease [0.2, 0.8, 0.2, 1]) when it enters viewport.

**Effort**: ~2 hours.

### 2.3 Spotlight border on listing cards

Use a CSS radial gradient that follows the cursor inside each card via
two CSS custom properties (`--x`, `--y`) updated on `mousemove`. Hide
under `prefers-reduced-motion`.

**Files**
- `src/index.css` — add `.spotlight-card { ... }` utility with a
  `::before` overlay using `radial-gradient(circle at var(--x) var(--y), ...)`.
- `src/features/ads/AdsGrid.tsx` — add `onMouseMove` handler that sets
  the CSS vars on the card root.

**Acceptance**: hover over any card → a soft red-tinted glow follows
the pointer along the rounded border.

**Effort**: ~2 hours.

### 2.4 Micro-interactions

- **Heart bounce** on Save Ad: spring `scale: [1, 1.25, 1]` 250ms
  + heart fills via Lucide `<Heart fill="currentColor" />`.
- **Number count-up** on dashboard stats (0 → final value over ~700ms).
  Use `framer-motion`'s `useMotionValue` + `useTransform`.
- **Variable-weight Fraunces hover** on the home hero — Fraunces is a
  variable font, animate `font-variation-settings: 'wght' 400 → 600` on
  hover.

**Effort**: ~2 hours total.

**Skill to reach for**: `gpt-taste` (GSAP-style scroll triggers,
spring physics) or `high-end-visual-design`.

---

## Phase 3 — Texture & depth

Skills flag "flat design with zero texture" as the second most common AI
fingerprint after the symmetric three-card row.

### 3.1 Global grain overlay

A fixed `pointer-events: none` overlay on every page with a tiled noise
SVG at ~2.5% opacity. Breaks the perfect flatness.

**Files**
- `src/index.css` — add a `body::after` rule with an inline data-URL
  SVG noise pattern.
- Make it `display: none` under `prefers-reduced-motion: reduce` —
  noise can be a vestibular trigger.

**Acceptance**: visible grain across light + dark mode; perfectly flat
areas (`bg-card`, `bg-background`) get the tiniest hint of texture.

**Effort**: ~30 min.

### 3.2 Tinted gradient overlays on listing card images

Replace the plain "darken on hover" overlay with a soft radial gradient
that fades from `transparent` at top to a slight warm-tint at bottom.
Should make light-image listings less stark.

**File**: `src/features/ads/AdsGrid.tsx`.

**Effort**: ~30 min.

### 3.3 Subtle ambient gradient on AdDetail hero

Behind the image gallery on AdDetail, add a soft radial gradient using
the primary color at very low opacity. Looks like a brand "glow" without
being neon.

**File**: `src/features/ads/AdDetail.tsx`.

**Effort**: ~1 hour.

---

## Phase 4 — Iconography

Lucide is named in the skills' "AI default" list. Two paths:

### Path A — Swap to Phosphor (recommended)

Phosphor has more editorial weight variants (regular / fill / duotone /
light) and pairs better with the serif display font.

**Files**: every file currently importing from `lucide-react` (~80
imports). Install `@phosphor-icons/react`, update imports, audit per-use
to pick the right weight (`Phone` instead of `<Smartphone />`,
`MagnifyingGlass` instead of `<Search />`, etc.).

**Acceptance**: zero `lucide-react` imports remain. Stroke weights
consistent (audit found mixed 1.5 / 2 / 2.25 currently).

**Effort**: ~4 hours (mechanical but every file).

### Path B — Keep Lucide, unify strokes

Lower-risk alternative: audit all Lucide `<Icon strokeWidth={X} />` and
standardize on 2 (or 2.25 for brand emphasis). Cheaper but doesn't move
the needle on differentiation.

**Effort**: ~1 hour.

### 4.1 Brand mark refresh

`public/icons/icon-48x48.png` is generic. A custom wordmark + glyph
would tie the editorial typography together.

**Effort**: design-led, scope TBD.

---

## Phase 5 — Navigation & discovery

### 5.1 Command palette (⌘K)

Modern marketplace expectation. Searches across listings, jumps to
categories, dashboard tabs, account settings.

**Files**
- New: `src/components/ui/CommandPalette.tsx` — a portal-mounted
  dialog with a search input and grouped results (Listings, Categories,
  Account, Help).
- `src/features/layout/Layout.tsx` — global ⌘K listener, render the
  palette.
- `src/context/MarketplaceContext.tsx` — expose a `searchListings`
  helper that hits the existing Convex `ads.searchAds` index.

**Acceptance**: ⌘K opens from anywhere; ESC closes; Enter on a result
navigates. Style matches the contract modal (`bg-card ring-1
ring-border/70 rounded-2xl shadow-card-hover`).

**Effort**: ~4 hours.

### 5.2 Breadcrumbs on AdDetail

`Home › Electronics › "iPhone 15 Pro Max…"` above the hero image.

**File**: `src/features/ads/AdDetail.tsx`.

**Effort**: ~30 min.

### 5.3 Recently viewed row on Home (auth users)

See Phase 1.2.

### 5.4 Filters bar above the home grid

Sort by (newest, price asc / desc, distance), price range slider,
location radius (10km / 25km / 50km / any). The state lives in URL
search params so deep-links work.

**Files**
- New: `src/features/ads/AdsFilterBar.tsx`.
- `src/pages/HomePage.tsx` — render filter bar above grid; pass values
  to MarketplaceContext.
- `src/context/MarketplaceContext.tsx` — extend the Convex `paginate`
  call's filter args.

**Effort**: ~4 hours.

---

## Phase 6 — Performance UX

### 6.1 Optimistic Save Ad

Heart fills immediately on click; Convex mutation runs in background;
revert on error.

**File**: `src/features/ads/AdDetail.tsx` (and the dashboard saved
list).

**Effort**: ~1 hour.

### 6.2 Blur-up image loading

Replace the plain shimmer skeleton with a tiny BlurHash or thumbhash
encoded into the listing metadata. Loads instantly, sharp image fades
over the blur.

**Files**
- `convex/schema.ts` — add `blurHash: v.optional(v.string())` to ads.
- `convex/posts.ts` — compute on upload (server-side using a worker).
- `src/components/ui/ImageDisplay.tsx` — render the blur as a CSS
  background-image while the real image loads.

**Effort**: ~3 hours. Touches Convex schema so coordinate with backend.

### 6.3 View Transitions API on route changes

Chrome stable. Wrap navigation in `document.startViewTransition` so
route changes get a smooth crossfade. Falls back gracefully on
non-Chromium.

**File**: `src/features/layout/Layout.tsx` (or a custom router wrapper).

**Effort**: ~1 hour.

### 6.4 Lighthouse pass

Use `chrome-devtools-mcp:debug-optimize-lcp` skill against `/` and
`/ad/:id`. Likely findings: image LCP could improve with `fetchpriority`,
font preload, deferred Convex bundle.

**Effort**: ~2 hours including fixes.

---

## Recommended sequence

If you have **half a day**: Phase 1.1 (featured card) + Phase 2.1
(reduced-motion guard) + Phase 3.1 (grain overlay).

If you have **a full day**: above + Phase 2.3 (spotlight card) + Phase
3.2 (image gradients) + Phase 5.2 (breadcrumbs).

If you have **a week**: knock out Phases 1–3 fully, then pick Phase 5
or 6 based on whether you want to feel premium (5) or *be* premium (6).

---

## Tooling notes for the next session

- **Dev server**: `npm run dev` from repo root (`/Users/amir.rudd/flyerBoard/FlyerBoard`).
- **Verify a change**: `npx tsc -p . --noEmit && npx vitest run`. The
  test suite has 312 tests across 36 files and runs in ~4s.
- **DOM audit**: `node scripts/dom-audit.mjs` — Playwright probe that
  walks 9 routes and reports landmarks / headings / nested interactives
  / accessible names. Used after every visual change.
- **Browser inspection**: `chrome-devtools-mcp` is installed. Use
  `take_snapshot`, `take_screenshot`, `evaluate_script`, `click`,
  `navigate_page` to drive the live app.
- **Re-running parallel work**: the `.claude/workflows/redesign-clusters.workflow.js`
  workflow file is preserved — same shape can be reused to fan out
  Phase work in parallel worktrees.
- **Branch**: continue on `design/premium-redesign` or branch from it.
  Currently 15 commits ahead of main; the merge into main is a separate
  decision.

## What not to do

- Don't redefine tokens — extend usage of the existing ones.
- Don't change Convex queries or routing while touching visuals.
- Don't break the test-pinned strings: `"All Flyers"`, `"PIN"`,
  `"Open to Trade"`, `"• Trade"`, `"{Category} Flyers"`,
  `"Pin Your Flyer"`, `"Search in flyers..."`,
  `"Verify Your Australian Phone Number"`, etc. Grep before changing
  any literal copy.
- Don't add a parallel design system. The contract is set — ship into
  it.
