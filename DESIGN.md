---
name: FlyerBoard
description: A cleaner, friendlier classifieds marketplace — warm paper, one confident red, editorial serif headlines.
colors:
  brand-red: "#DC3626"
  brand-red-deep: "#C72A1E"
  warm-cream: "#FAF8F4"
  card-white: "#FEFDFC"
  warm-surface: "#F1EDE9"
  warm-ink: "#231E1A"
  warm-muted-ink: "#746A63"
  warm-border: "#E3DDD9"
  bundle-teal: "#0D9689"
  destructive-red: "#EF4444"
typography:
  display:
    fontFamily: "Fraunces, ui-serif, Georgia, serif"
    fontSize: "clamp(2rem, 4vw, 3.5rem)"
    fontWeight: 500
    lineHeight: 1.05
    letterSpacing: "-0.02em"
    fontFeature: "ss01, ss02"
  headline:
    fontFamily: "Fraunces, ui-serif, Georgia, serif"
    fontSize: "1.75rem"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Plus Jakarta Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "normal"
  body:
    fontFamily: "Plus Jakarta Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
    fontFeature: "ss01, cv11"
  label:
    fontFamily: "Plus Jakarta Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.14em"
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  "2xl": "24px"
  full: "9999px"
spacing:
  xs: "0.5rem"
  sm: "0.75rem"
  md: "1rem"
  lg: "1.5rem"
  xl: "2rem"
components:
  button-primary:
    backgroundColor: "{colors.brand-red}"
    textColor: "{colors.card-white}"
    rounded: "{rounded.full}"
    padding: "0 24px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.brand-red-deep}"
    textColor: "{colors.card-white}"
    rounded: "{rounded.full}"
  button-secondary:
    backgroundColor: "{colors.warm-surface}"
    textColor: "{colors.warm-ink}"
    rounded: "{rounded.full}"
    padding: "0 20px"
    height: "44px"
  chip:
    backgroundColor: "{colors.warm-surface}"
    textColor: "{colors.warm-ink}"
    rounded: "{rounded.full}"
    padding: "4px 12px"
  chip-brand:
    backgroundColor: "{colors.brand-red}"
    textColor: "{colors.brand-red}"
    rounded: "{rounded.full}"
    padding: "4px 10px"
  input-search:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.warm-ink}"
    rounded: "{rounded.full}"
    padding: "0 16px"
    height: "44px"
  card-listing:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.warm-ink}"
    rounded: "{rounded.lg}"
    padding: "0"
---

# Design System: FlyerBoard

## 1. Overview

**Creative North Star: "The Warm Noticeboard"**

FlyerBoard is a classifieds marketplace that feels like a friendly neighbourhood board, not a database of listings. The surface is warm paper — a calibrated cream neutral on a 25–34° hue (`#FAF8F4`) — under an almost-invisible film grain that breaks the flat digital look. Against that calm canvas, exactly one voice cuts through: the brand red (`#DC3626`). Headlines are set in Fraunces, a variable serif that gives the marketplace a magazine's composure; everything else — labels, prices, buttons, body — is Plus Jakarta Sans, a clean humanist sans that stays out of the way. The result is trustworthy and human, confident without shouting.

This system exists to feel calmer and more considered than the sites it replaces. It explicitly rejects the cluttered grey listing walls and dated chrome of old Gumtree; the cold enterprise-navy sterility of a corporate SaaS dashboard; and the screaming SALE-badge chaos of discount-retail marketplaces. Warmth and trust come first; loudness and clutter are the failure modes. Depth is quiet — surfaces sit flat at rest and lift with a warm-tinted shadow only when you touch them.

Everything is mobile-first and one-handed. The feed is the heartbeat, chronological and honest. Density is earned, never default; when in doubt, remove.

**Key Characteristics:**
- Warm cream paper base with a single confident red accent — never a second loud colour.
- Editorial serif (Fraunces) for headlines, humanist sans (Plus Jakarta Sans) for everything else.
- Full-pill, tactile buttons with a springy press; warm-tinted shadows, never pure black.
- Signature texture: subtle film grain, ambient brand glow, cursor-tracked spotlight on cards.
- Flat-by-default depth; motion and shadow appear as a response to state.

## 2. Colors

A warm, single-family palette: one red brand voice on a cream-to-ink warm-neutral ramp, with a teal reserved strictly for the Bundle feature. All tokens are authored as HSL channels in `src/index.css` (`hsl(var(--token))`); the hex values below are the sRGB equivalents.

### Primary
- **Brand Red** (`#DC3626`, `hsl(5 71% 51%)`): The single accent voice. Primary CTAs (full-pill buttons), the current selection, active nav, links, focus rings, and brand glows. In dark mode it deepens to `hsl(5 65% 42%)` for button fills; a brighter `--primary-bright` variant (`hsl(5 75% 65%)`) is swapped in for `text/fill/stroke-primary` so text meets AA against the dark canvas.
- **Brand Red Deep** (`#C72A1E`): The hover/pressed tone of the brand red.

### Secondary
- **Bundle Teal** (`#0D9689`, `hsl(174 84% 32%)`): Reserved exclusively for the Bundle Listing feature. A semantic token group (`--bundle`, `--bundle-foreground`, `--bundle-emphasis`) so the whole feature re-themes from one place. Never used as a general accent.

### Neutral
- **Warm Cream** (`#FAF8F4`, `hsl(34 25% 97.5%)`): The body background. Warm paper, the calm canvas everything sits on.
- **Card White** (`#FEFDFC`, `hsl(30 20% 99.5%)`): Cards, popovers, sheets — a hair brighter than the cream so surfaces read as lifted off the page without a border.
- **Warm Surface** (`#F1EDE9`, `hsl(30 16–18% 93–94%)`): Secondary/muted fills — unselected chips, hover states, quiet buttons.
- **Warm Ink** (`#231E1A`, `hsl(24 14% 12%)`): Primary text. Warm near-black, never pure `#000`.
- **Warm Muted Ink** (`#746A63`, `hsl(25 8% 42%)`): Secondary text, metadata, timestamps, placeholders. Use at full opacity for body-level text; it is the floor for readable muted text on cream.
- **Warm Border** (`#E3DDD9`, `hsl(25 14% 87%)`): Hairline dividers, input strokes, card edges. 1px only.

### Utility
- **Destructive Red** (`#EF4444`, `hsl(0 84.2% 60.2%)`): Errors, destructive confirmations, delete. Distinct from the warmer brand red — kept separate so "danger" never reads as "brand."

### Named Rules
**The One Voice Rule.** The brand red is the only loud colour on any screen, and it appears on ≤10% of the surface — CTAs, current selection, and state indicators only, never decoration. A second saturated colour competing with it is prohibited. Bundle teal is the one sanctioned exception and lives only inside the Bundle feature.

**The Warm-Black Rule.** No pure `#000` and no pure neutral grey. Every "black," "grey," and shadow carries the warm hue — ink is `hsl(24 14% 12%)`, shadows ride a `hsl(12 35% 22%)` channel. Cool or blue-grey neutrals read as corporate and are forbidden on content surfaces. (A legacy cool-neutral ramp survives in the Tailwind config for backward compatibility; do not reach for it in new work.)

## 3. Typography

**Display Font:** Fraunces (with `ui-serif, Georgia, serif`) — variable, optical-size aware, weights 400–800.
**Body Font:** Plus Jakarta Sans (with `ui-sans-serif, system-ui`) — weights 400–800.

**Character:** A true contrast pairing — an expressive optical serif against a clean humanist sans. Fraunces gives headlines editorial warmth and personality (it even shifts weight on hover on hero headings, 500→650, via `font-variation-settings`); Plus Jakarta Sans keeps the working UI calm, legible, and modern. Never pair two sans or two serifs here; the serif/sans contrast is the whole point.

### Hierarchy
- **Display** (Fraunces, 500, `clamp(2rem, 4vw, 3.5rem)`, line-height ~1.05, `-0.02em`): Hero and page headlines. `text-wrap: balance`, `tracking-tight`, ligature sets `ss01 ss02`.
- **Headline** (Fraunces, 600, ~1.75rem): Section headings within a page.
- **Title** (Plus Jakarta Sans, 600, ~1.125rem): Card titles, listing names, dialog titles — where a serif would be too much personality for dense UI.
- **Body** (Plus Jakarta Sans, 400, 1rem, line-height ~1.55): Descriptions and prose. Cap prose at 65–75ch; the static-content pages use a 960px reading column.
- **Label** (Plus Jakarta Sans, 600, 0.6875rem/11px, `0.14em`, UPPERCASE): The `.kicker` — small-caps tracked eyebrow in muted ink. Also chip and pill text (often `0.08em`).

### Named Rules
**The Serif-Headlines-Only Rule.** Fraunces is for headlines and hero moments only. Buttons, labels, inputs, table data, and dense UI are always Plus Jakarta Sans. A serif on a button or a form label is prohibited.

**The Tabular-Numbers Rule.** Prices, counts, and dates use `.tabular` (`font-variant-numeric: tabular-nums`) so columns and figures stay aligned. Never let a price column ragged-align on proportional digits.

## 4. Elevation

Flat by default, warm on touch. Surfaces rest nearly flat against the cream — a card is separated from the page by its slightly brighter `card-white` fill and a 1px warm border far more than by shadow. Shadows are a *response to state*: they appear (or deepen) on hover and focus, and they are always warm-tinted (`hsl(var(--shadow-color) / …)`, a `12 35% 22%` channel), never black. Additional depth is atmospheric, not structural — a subtle film grain over the whole page, an ambient radial brand glow behind the gallery, and a cursor-tracked spotlight on listing cards.

### Shadow Vocabulary
- **card** (`0 1px 2px hsl(var(--shadow-color)/0.04), 0 2px 8px -2px hsl(var(--shadow-color)/0.05)`): The resting state of a listing card — almost imperceptible.
- **card-hover** (`0 4px 10px hsl(var(--shadow-color)/0.08), 0 16px 32px -12px hsl(var(--shadow-color)/0.18)`): The lift on hover, paired with `translateY(-3px)`.
- **soft** (`0 4px 20px -2px hsl(var(--shadow-color)/0.06)`): Diffuse warmth under panels and sheets.
- **glow** (`0 0 15px hsl(var(--primary)/0.30)`): Brand-red halo for emphasis moments only.
- **sm / DEFAULT / md / lg / xl**: A standard warm-tinted ramp for popovers, dropdowns, and modals.

### Named Rules
**The Flat-By-Default Rule.** Surfaces are flat at rest; elevation is earned by interaction. A card that already floats at rest has nowhere to go on hover — reserve the lift for the pointer. If it looks like it's floating before you touch it, the resting shadow is too heavy.

**The Warm-Shadow Rule.** Every shadow rides the `--shadow-color` channel, never `rgba(0,0,0,…)`. A cold black shadow on warm cream reads as a foreign object.

## 5. Components

### Buttons
- **Shape:** Full pill (`rounded-full`, 9999px), height 44px (`h-11`). Rounded, tactile, confident.
- **Primary:** Brand red fill, `card-white` text, `px-6`; soft brand-tinted shadow (`shadow-sm shadow-primary/25`). The workhorse CTA.
- **Hover / Focus / Active:** Hover deepens to `bg-primary/90`; active presses with `scale-[0.98]`; focus shows a 2px `ring-ring` with a 2px offset against the background. Every button carries all four states — never ship default-only.
- **Secondary / Ghost:** Secondary uses `warm-surface` fill with warm-ink text. Ghost is transparent with `text-muted-foreground`, hovering to `bg-muted/60` and full-ink text. Same pill shape, same press.

### Chips
- **Style:** Full-pill. Neutral chips use `warm-surface` bg + warm-ink text. Brand chips use `bg-primary/10` + `text-primary`, often uppercase at 11px with `0.08em` tracking (the kicker treatment).
- **State:** Selected = brand red tint or fill; unselected = warm-surface. Filter chips and action chips share one vocabulary.

### Cards / Containers
- **Corner Style:** `rounded-lg` (12px); listing cards round to 14px on focus.
- **Background:** `card-white`, a hair brighter than the cream canvas.
- **Shadow Strategy:** `shadow-card` at rest (near-flat), `shadow-card-hover` + `translateY(-3px)` on hover — see Elevation.
- **Border:** Optional 1px `warm-border` hairline. No borders heavier than 1px, and never a coloured side-stripe.
- **Signature:** Listing cards are `.listing-card` (GPU-accelerated, `contain: layout style paint`) and may carry a cursor-tracked `.spotlight-card` radial brand glow. Internal padding on a scale of 12–16px.

### Inputs / Fields
- **Style:** Full-pill search inputs (`rounded-full`) on `card-white` with a 1px warm ring; form fields use `.auth-input-field` (rounded-xl, warm border). Placeholder text at `muted-foreground/70`.
- **Focus:** Brand-red focus ring — `ring-2 ring-primary/20` and `border-primary` (search inputs shift to `ring-ring` + `bg-card`). A visible focus state is mandatory.
- **Error:** Destructive red border + message; never rely on colour alone.

### Navigation
- **Desktop:** Sticky top header (57px, set locally in `Header.tsx` — never via a global `header{}` rule). Plus Jakarta Sans; active item in brand red, inactive in muted ink hovering to full ink.
- **Mobile:** Fixed bottom nav (`--bottom-nav-height`, 72px + safe-area inset), one-handed. Content reserves space with `.pb-bottom-nav`; safe-area utilities (`pb-safe`, `pt-safe`) respect notches and PWA standalone mode.

## 6. Do's and Don'ts

### Do:
- **Do** keep the brand red (`#DC3626`) as the single loud voice — CTAs, current selection, and state only, on ≤10% of any screen.
- **Do** set headlines in Fraunces and everything else in Plus Jakarta Sans; lean on the serif/sans contrast for hierarchy.
- **Do** keep surfaces flat at rest and let warm-tinted shadow appear on hover/focus (`shadow-card` → `shadow-card-hover`).
- **Do** use warm neutrals only — warm-ink text (`hsl(24 14% 12%)`), warm borders, warm shadows on the `--shadow-color` channel.
- **Do** give every interactive element its full state set: default, hover, focus-visible ring, active `scale-[0.98]`, disabled, loading (skeletons, not centre-spinners).
- **Do** use `.tabular` for prices, counts, and dates.
- **Do** design mobile-first and one-handed; respect safe-area insets and `prefers-reduced-motion` (via `useMotionPrefs`).

### Don't:
- **Don't** recreate the cluttered, spammy old-Gumtree feel — no dense grey listing walls, dated chrome, or ad-choked pages. Density is earned; when in doubt, remove.
- **Don't** drift toward cold corporate SaaS — no enterprise navy, no blue-grey neutrals, no data-tool sterility stripped of warmth.
- **Don't** go loud discount-retail — no screaming SALE badges, no coupon-site chaos, no aggressive upsell on every surface.
- **Don't** introduce a second saturated accent to compete with the red. Bundle teal is the only exception and stays inside the Bundle feature.
- **Don't** use pure `#000`, pure neutral grey, or `rgba(0,0,0,…)` shadows on content surfaces.
- **Don't** put Fraunces on buttons, labels, inputs, or table data.
- **Don't** use a coloured `border-left`/`border-right` stripe, gradient text as meaning, or glassmorphism as a default surface (the `.glass` utility is reserved for rare, purposeful moments).
- **Don't** ship a card that floats at rest — if it's shadowed before you touch it, the resting elevation is too heavy.
