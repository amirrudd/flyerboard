# Bundle Listing

**Last Updated**: 2026-07-16 (fixed home-feed layout shift from late bundle/sale card pop-in)

Standalone feature: a seller groups a small, fixed set (2–4) of their OWN standalone
ads at a discounted package price. No sale page / QR / pickup window (that's Moving
Sale). Design doc: `ResearchLab/ideas/bundle-listing-design.md`.

Gated behind the `bundleListing` feature flag (seeded in `migrations:seedFeatureFlags`,
mirrors `movingSaleMode`). Flag OFF hides every entry point; it does not delete data.

## Data model — shares `saleBundles` with Moving Sale (reconciled)

Moving Sale shipped `saleBundles` FIRST, with an incompatible shape (`saleEventId`
**required**, `label` required, no `sellerId`/`status`/`isDeleted`). Bundle Listing
extended it **backward-compatibly**:

```ts
saleBundles: defineTable({
  sellerId: v.optional(v.id("users")),          // OWNER — always set on new writes; optional only so the
                                                //   schema push validates against pre-existing Moving Sale rows
  saleEventId: v.optional(v.id("saleEvents")),  // undefined = STANDALONE bundle; set = Moving Sale suggestion
  label: v.string(),                            // display title (NOT "title" — the doc's early drafts were wrong)
  bundlePrice: v.number(),
  adIds: v.array(v.id("ads")),                  // exactly 2..4 for standalone
  status: v.optional(v.union(                   // missing => "active" (legacy Sale rows)
    "active" | "partial" | "sold" | "cancelled")),
  isDeleted: v.optional(v.boolean()),
}).index("by_sale_event", ["saleEventId"]).index("by_seller", ["sellerId"])
```

**Why `sellerId`/`status` are OPTIONAL not required** (deviates from the doc's
"required"): the live deployment already has `saleBundles` rows from seed/Moving Sale.
A schema push adding a *required* field fails validation against those rows. So they're
declared optional, **every new write populates them**, reads treat missing `status` as
`"active"` (`bundleStatus()` helper in `convex/bundles.ts`), and a one-off backfill
(`migrations:backfillSaleBundles`, idempotent) fills legacy rows (`sellerId` from
`saleEvent.userId`). Tighten to required only after the backfill has run in prod.

`ads` already had `bundleId?`, `saleEventId?`, `isSold?` (added by Moving Sale).

## Invariants (enforced in mutations, not the validator)
- An ad is in **at most one** bundle — `ads.bundleId` is singular (overlapping bundles
  explicitly deferred; see doc).
- `bundleId` and `saleEventId` are **mutually exclusive** on an ad — `createBundle`
  rejects an ad with a `saleEventId`; Sale item-add should reject a `bundleId` (partial —
  bundle picker excludes Sale ads, Sale-side guard is the remaining TODO if needed).
- Standalone-only helpers skip any bundle with a `saleEventId` (never touch Sale bundles).

## Backend — `convex/bundles.ts`
Constants `BUNDLE_MIN_ITEMS = 2`, `BUNDLE_MAX_ITEMS = 4` (the doc's "exactly N" is a
tunable constant; 2–4 is what shipped). The 2–4 cap is a deliberate product decision
(2026-07-05), not arbitrary: 4 covers the "room set" mental model that makes bundling
attractive; item-count monetisation was considered and deferred (see
`docs/architecture/design-decisions.md` § "Bundle Listing — item cap"). Don't lower the
cap or gate it behind payment without revisiting that decision.

Mutations: `createBundle({adIds,bundlePrice,label?})` (validates eligibility + caps +
rate limit `createBundle`), `updateBundlePrice`, `removeBundleItem` (auto-cancels if
<MIN remain, frees survivors), `cancelBundle` (reverts all to standalone),
`markBundleSold` (asserts ALL available FIRST, then marks — no half-apply; throws on a
race so the caller stays `partial`), `markBundleItemSold` (individual sale → `partial`).

Queries: `getBundleBannerForAd` (ad-detail banner — **active only**, current item first,
returns null once partial/sold/cancelled so the banner disappears), `getMyBundles`
(dashboard tags/manage), `getBundle` (owner manage payload), `getActiveBundleFeedCards`
(feed — active standalone only, includes `adIds` for tap-through), `getEligibleAdsForBundle`
(picker grid with `{eligible, reason}`).

**Integrity hook:** `posts.deleteAd` calls the exported `detachAdFromBundle(ctx, ad, "deleted")`
BEFORE soft-deleting — a deleted member drops the bundle to `partial` (or `cancelled` if
<MIN remain). Any future "restore ad" or other soft-delete site should consider re-attaching.

**Call-site audit done:** `saleEvents.setBundles` now also writes `sellerId` + `status:"active"`
so Sale-created bundles match the standalone shape.

~~Feed-card tap-through has no dedicated public bundle page~~ **Superseded by v2 (2026-07-05,
see "Bundle v2" section below):** the feed card now navigates to `/bundle/:id`, the bundle's
own public page. The ad-detail banner's *body* also taps through to it; banner item thumbnails
still link to each member ad (with `stopPropagation`); the current item stays dimmed +
non-clickable.

### Shared helpers (added in a `/simplify` pass, post-build)
The 4 read queries and 5 mutations had converged on the same few patterns copy-pasted
per-handler — factored out once real code review (4 parallel reuse/simplification/
efficiency/altitude agents) surfaced it:
- `hydrateBundleItems(ctx, adIds, { excludeSold? })` — the `Promise.all(adIds.map(ctx.db.get)).filter(isDeleted...)` resolve-and-drop-dead pattern, used by all 4 queries.
- `computeSavings(total, bundlePrice)` → `{ savings, savingsPct }` — was hand-duplicated 5x.
- `freeAdsFromBundle(ctx, adIds, bundleId)` — the "clear bundleId on every ad that still points here" loop, shared by `detachAdFromBundle`/`removeBundleItem`/`cancelBundle`. Filters to a Promise-only array before `Promise.all` — a ternary with an `undefined` false-branch inside `Promise.all(...)` trips `@typescript-eslint/no-misused-promises`-family lint (mixed thenable/non-thenable array); filter-then-map instead.
- `bundleOwnerId(ctx, bundle)` — `getBundle` was checking `bundle.sellerId !== userId` directly while `requireOwnedBundle` had a `sellerId ?? (via saleEventId)` fallback; unified into one helper both call.
- All 5 mutations' `for (const id of ids) { await ctx.db.get(id); ... }` validation/assert loops converted to `Promise.all(ids.map(ctx.db.get))` fetched up front, then a synchronous indexed loop over the resolved array so throw-order/error messages stay identical (concurrent reads, same observable behavior).
- `useMotionPrefs()` gained a `slideStep()` helper (horizontal slide, mirrors `fadeUp`'s shape) so `BundleFlow.tsx`'s 3-step wizard stops hand-rolling its own easing-curve/reduced-motion object — was a literal duplicate of the hook's `EASE` constant.
- `ItemThumb` — the "image or Package-icon placeholder" tile. First extracted locally inside `BundleFlow.tsx` (copy-pasted 3x across picker/price/confirm), then **promoted to its own file `src/features/bundles/ItemThumb.tsx`** in the 2nd pass and reused by `BundleManageModal.tsx` (its inline tile was byte-identical, `iconSize={16}`). `BundleThumbnail.tsx` is a *different* pattern (multi-cover vertical strips) — deliberately not consolidated.
- `withBusy(fallbackError, fn)` in `BundleManageModal.tsx` (2nd pass) — the `setBusy(true)/try
  → catch toast.error/finally setBusy(false)` scaffolding was copy-pasted across all 4 mutation
  handlers. Factored into one wrapper; each caller passes its own async body so the **distinct
  success/error copy and branches stay intact** (`handleRemove`'s `res.status === "cancelled"`
  break-up path, `handleSavePrice`'s `priceDirty` guard). Handlers are now synchronous
  void-returning fns wrapping `void withBusy(...)`; the `onClick={() => { void handleX() }}` call
  sites are unchanged and lint-clean.

**Explicitly left alone** (real findings, wrong scope for a same-diff cleanup — each would touch an already-shipped sibling file):
- `BundleThumbnail.tsx` vs `SaleThumbnail.tsx` (Moving Sale's sibling thumbnail) share a lot of "degrade by cover count" logic with no common base — worth a shared `MultiImageThumbnail` primitive if a third thumbnail-with-fallback ever appears.
- `BundleManageModal.tsx`'s `createPortal` shell duplicates `UserDashboard.tsx`'s delete-confirm modal scaffolding — no existing extracted `Modal` primitive to point at yet.
- `MIN_ITEMS`/`MAX_ITEMS` stay **locally re-declared** in `BundleFlow.tsx` rather than importing `BUNDLE_MIN_ITEMS`/`BUNDLE_MAX_ITEMS` from `convex/bundles.ts` — that file transitively imports server-only Convex modules (`mutation`/`query`, `getDescopeUserId`, rate limiting) that shouldn't end up in the client bundle. A comment ties the two together instead; if this bites, the right fix is extracting the constants into a convex-free shared file, not a direct cross-boundary import.
- `posts.ts` importing `detachAdFromBundle` from `bundles.ts` is a new (first-of-its-kind) cross-domain coupling — accepted as-is for one hook; if a second "on ad delete" side effect shows up, centralize via a small lifecycle-hook list instead of a second ad-hoc import.

**Re-reviewed and still left alone (2nd `/simplify` pass, 2026-07-05):**
- A `notHidden(q)` helper for the `q.neq(isDeleted,true), q.neq(isSold,true)` pair repeated in `convex/ads.ts`'s 4 filter branches — skipped: each site combines it with *different* surrounding conditions, cleanly typing the Convex filter-builder param risks an `any`, and it's a hot query path. Removing 2 short clauses per site isn't worth it.
- Sharing `MIN/MAX_ITEMS` across the convex↔src boundary (see the constants bullet above) — re-confirmed skip.
- A shared `validateAdIds` between `createBundle` and `markBundleSold` — skipped: the only truly common part is the one-line `Promise.all(adIds.map(ctx.db.get))` fetch; the existence checks have divergent error copy and the two loops enforce different rule-sets (eligibility/mutual-exclusion vs membership/status). Conflating them would risk weakening validation on high-stakes mutations.
- Backend micro-opts in `bundles.ts` (single-pass reorder in `getBundleBannerForAd`, batch hydrate in `getMyBundles`, a `by_status` index for `getActiveBundleFeedCards`) — premature: tiny data volumes, feature behind the `bundleListing` flag. Revisit only if post-launch profiling shows a hotspot; the index one needs a schema change + migration.

## Frontend
- `src/features/bundles/` — `BundleThumbnail` (feed: N vertical strips, blue "Bundle"
  badge + "Save $X" pill), `BundleBanner` (ad-detail, blue, `+`-connected thumbs, inline
  `$X together / vs $Y separately / Save Z%` math), `BundleFlow` (3-step wizard: picker →
  price w/ live savings → confirm), `BundleManageModal` (edit price / remove / mark sold /
  cancel).
- Route `/sell/bundle` (+ `?preselect=<adId>`), lazy, outside `<Layout>` — mirrors
  `/sell/moving-sale`. Page: `src/pages/BundlePage.tsx`.
- `AdsGrid` gained a `"bundle"` `FeedEntry` kind + `bundleCards`/`onBundleClick` props;
  `HomePage` wires `api.bundles.getActiveBundleFeedCards` (skip unless flag on & no category).

### Gotcha: bundle/sale cards pop into the feed late, shifting layout (fixed 2026-07-16)
`bundleCards`/`activeSales` are separate `useQuery` calls gated behind their own
`useFeatureFlag` query resolving first (`HomePage.tsx`) — a second round-trip that lands
well after the main ads pagination query paints. `AdsGrid`'s skeleton gate
(`isLoading || ads === undefined`) only looked at the ads query, and `bundleCards`/
`saleCards` default to `[]` when still `undefined` — so the feed rendered ads-only, then
the Sale/Bundle card popped into its date-sorted slot later and shifted every card below
it. Fixed by computing `auxCardsPending` in `HomePage.tsx` (true while `!selectedCategory`
and either flag is `true`/unresolved and its card query hasn't resolved yet) and OR-ing it
into the `isLoading` prop passed to `AdsGrid`. Any *new* feed-merged card type gated behind
a feature flag must extend this same `auxCardsPending` check — don't just add another
independent `useQuery` and expect the skeleton to account for it.
- `AdDetail` renders `BundleBanner` right after the Sale banner (an ad is never in both).
- `UserDashboard` ads tab: blue "Bundle ads" header button, per-card "📦 In bundle: {label}"
  tag (opens manage modal) or "Bundle this →" (→ `/sell/bundle?preselect=`), all flag-gated.
- **Accent color = TEAL, via a semantic token** (2026-07-05, was hardcoded `blue-*`). Every
  bundle surface uses the `bundle` Tailwind color — `bg-bundle` (solid), `text-bundle-foreground`
  (on solid), `text-bundle-emphasis` (ink on a `bundle/10` tint), `ring-bundle`, `border-bundle`.
  The values live in ONE place: `--bundle` / `--bundle-foreground` / `--bundle-emphasis` in
  `src/index.css` (`:root` + `.dark`, mode-aware), wired in `tailwind.config.js`. Re-theme the
  whole feature by editing those 3 CSS vars — never reintroduce raw `blue-*`/`teal-*` classes.
  `-emphasis` is mode-aware so the old `text-blue-700 dark:text-blue-400` pairs collapsed to a
  single `text-bundle-emphasis`. Icon = Phosphor `Package`; nav-tab icon = `Stack`.
- **Dashboard `BundlesTab`** (`src/features/dashboard/BundlesTab.tsx`) — a dedicated "Bundles"
  sidebar tab (gated on `bundleModeEnabled`, mirrors the `sales`/`MovingSalesTab` pattern incl.
  the URL-redirect guard when the flag is off). Lists the seller's bundles (reuses
  `BundleThumbnail` + `BundleManageModal`), with status pills active/partial/sold/cancelled.
  This is the primary place to *find* a bundle; the per-ad "In bundle: …" tag is the secondary
  entry. Tab union + scroll `refMap` in `UserDashboard.tsx` both needed the new `"bundles"` key.
- Motion via `useMotionPrefs()` only (bakes in reduced-motion); `AnimatePresence` for wizard
  step transitions.

### Gotcha: full-screen `/sell/*` flows need an internal scroll container, not body scroll
`BundleFlow` (and `MovingSaleFlow`) render outside `<Layout>` with a `min-h-[100dvh]` root and
step content in normal document flow — i.e. they relied on the **body** scrolling. But
`src/index.css:426` disables body scroll at `≤768px` (`@media (max-width:768px){ html,body{
overflow:hidden; height:100% } }` — a deliberate mobile pattern so only "designated containers"
scroll). Result: on a narrow viewport the wizard's primary CTA ("Create bundle" / "Set a bundle
price") fell below the fold and was **unreachable** — no scroll possible. Fixed 2026-07-03 in
`BundleFlow.tsx` **and `MovingSaleFlow.tsx`**: root is `flex h-[100dvh] flex-col`, the header is
a `shrink-0` flex child (dropped `sticky`), and the step content lives in a `flex-1
mobile-scroll-container` (the app's own iOS-momentum / overscroll-contained scroll utility).
Works on all widths — the container always owns its scroll instead of leaning on the body.

**This exact shell is now the shared `src/components/WizardShell.tsx`** (extracted 2026-07-05,
2nd `/simplify` pass). Both `/sell/*` wizards render `<WizardShell currentStep totalSteps onBack
onExit accentClassName showHeader>{steps}</WizardShell>` instead of hand-rolling the
`h-[100dvh]` column + back/progress-dots/exit chrome. Props that differ between the two flows:
`accentClassName` (`bg-bundle` vs default `bg-primary` for the reached progress dot), `onExit`
target (`/dashboard?tab=ads` vs `/dashboard`), and `showHeader` — MovingSale passes
`step !== "intro" && step !== "share"` so those two steps render **full-bleed & headerless**
(their content still sits inside the `.mobile-scroll-container`, so `IntroStep`'s `min-h-full`
fills correctly). If you touch the shell, keep the DOM structure byte-identical — the regression
guards below assume it.

Regression guards: `BundleFlow.test.tsx` asserts the CTA is inside `.mobile-scroll-container` and
the root is `h-[100dvh] flex-col` (jsdom can't measure overflow, so this guards the *structure*).
`e2e/wizard-mobile-scroll.spec.ts` (Playwright, Mobile Chrome) proves the CSS *mechanism* by
reconstructing the shell markup inline against the real stylesheet — note it does **not** import
the components, so it can't catch a component-level regression; the vitest structure test is the
one that guards the actual `WizardShell` output. `MovingSaleFlow` has no structural vitest test —
verify it manually after any shell change.

### Gotcha: global `input:focus` rule beats scoped `focus:` utilities via CSS cascade layers
`src/index.css:523` has an unlayered `input:focus, textarea:focus, select:focus { @apply ring-2
ring-primary/20 border-primary; }` (red ring). The bundle price/name inputs sit inside a wrapper
`<div>` that draws its own `focus-within:ring-*-blue-600` ring — the naive fix
(`focus:ring-0 focus:border-transparent` on the `<input>`) does NOT work, even though plain
specificity math says a class selector should beat a type selector. Why: Tailwind v4 compiles
both the `@apply`'d global rule and component-level `focus:` utilities into the SAME `@layer
utilities` — inside one layer, `input:focus` (0,1,1) still loses to `.focus\:ring-0:focus`
(0,2,0) in THEORY, but empirically the ring/border **color** custom-property assignment from the
global rule was still winning (verified via `getComputedStyle` — box-shadow showed the reddish
color with 0px spread, i.e. present-but-invisible, not fully cleared). The fix that actually
works: use Tailwind v4's importance suffix — `focus:ring-0! focus:border-transparent!` — which
forces the win regardless of the layer/specificity interaction. Applied to all 3 bundle inputs
(`BundleFlow.tsx` price + label, `BundleManageModal.tsx` price). If a future input needs to
override this global rule, use the same `!` suffix pattern — don't assume `focus:ring-0` alone
is enough. Verified live via `getComputedStyle(el).boxShadow` (ring spread went 2px → 0px) and a
Chrome DevTools MCP screenshot showing a single clean ring.

### Bug found via live browser testing: sold ads kept browsing as available
`markBundleSold`/`markBundleItemSold` flip `ads.isSold: true` on a fully STANDALONE ad —
the first time anything outside Moving Sale ever did that. `isSold` was previously only
ever visualized inside the Moving Sale public page (`PublicSaleView*`); the general
marketplace feed/search queries (`convex/ads.ts` `getAds`, `getLatestAds`) never filtered
on it. Result: a sold bundle item kept appearing as a normal, fully-priced, apparently-
available listing everywhere outside the dashboard — misleading to buyers. **Fixed** by
adding `q.neq(q.field("isSold"), true)` to all 4 filter branches (search + non-search) in
both queries, mirroring the existing `isDeleted` pattern exactly. `getUserAds` (dashboard)
and `getAdById` (direct-link resolution) are intentionally left unfiltered — the seller
needs to see/manage their own sold ads, and a direct link to a sold ad should still
resolve. Covered by `convex/ads.test.ts` (new file, 4 tests). Note: this same gap applies
to a Moving-Sale item sold individually via `setItemSold` — pre-existing, not introduced by
Bundle Listing, but now fixed as a side effect since it shares the same queries.

## Test gotchas (also noted in moving-sale.md)
- `BundleFlow.test.tsx` mocks `framer-motion` — `AnimatePresence mode="wait"` doesn't
  finish exit transitions in jsdom, so steps render synchronously.
- `AdDetail.test.tsx`'s blanket `useQuery` mock had to discriminate feature-flag queries by
  their `{key}` args shape (the generated `api` proxy does NOT return stable references, so
  identity checks on `api.bundles.*` don't work in mocks).
- `UserDashboard.test.tsx`: two new `useQuery` slots shifted the positional mock — the
  documented recurring gotcha; update the cycling mock + counters when adding queries.

Backend: `convex/bundles.test.ts` (29 tests — eligibility, caps, mutual exclusivity,
sold-state machine incl. atomic race, detach-on-delete, all queries).

## Bundle v2 — the bundle is a first-class destination (2026-07-05)

Founder review found the v1 flaw: the feed card tapped through to `adIds[0]`, so a bundle
had no page, no shareable URL, and no way to message *about the bundle*. v2 mirrors how
Moving Sale solved the same "grouping without a duplicate `ads` row" trade-off: grouping
table + derived feed card + **dedicated public route**. Design: `ResearchLab/ideas/
bundle-listing-design.md` § "v2 — Bundle becomes a first-class destination".

### Public page — `/bundle/:id`, the "Deal Ticket"
- Chosen from 3 mocked directions (Storefront / Deal Ticket / Editorial Set). The page
  leads with the OFFER, not the products: receipt-style ticket (line items with dotted
  leaders, dashed perforated rule with edge notches, struck "Separately $X", bundle price
  at display size in Fraunces, rotated "Save $Y / Z% off" stamp), image strip below (each
  thumb links to its member ad), trust line, seller card, sticky CTA. Deliberately looks
  nothing like an ad page — that ambiguity was the original flaw.
- `PublicBundlePage.tsx` (route inside `<Layout>`, lazy, mirrors `PublicSalePage`) +
  `PublicBundleView.tsx` (presentational) + `BundleMessageModal.tsx`.
- Backend: `bundles.getPublicBundle` — public/no-auth; returns null for missing/deleted/
  Sale-scoped/**cancelled**; `partial`/`sold` still resolve (old links + threads must keep
  working). Payload includes `isOwner` (owner sees a "manage" CTA → `/dashboard?tab=bundles`
  instead of messaging themselves).
- **Partial state finally has a home**: notice naming the sold member, sold rows greyed with
  a SOLD pill + struck price, "Buy {remaining} for $X ›" links replace the deal block.

### Bundle-scoped messaging — `convex/bundleChats.ts` (mirrors `saleChats.ts`)
- `chats` gained `bundleId` + `by_bundle_buyer` index. Exactly one of adId/saleEventId/
  bundleId per chat (mutation-enforced, not validator).
- `sendBundleMessage` / `getBundleThread`; one thread per buyer per bundle; NO item chips
  (unlike sale threads) — a bundle IS the package, the conversation is about the deal.
- Rejects cancelled bundles ("Bundle not found") and self-messaging.
- **Notification chain extended end-to-end with optional `bundleId`**:
  `notifications/queries.getChatNotificationContext` (title = bundle.label, urlPath =
  `/bundle/:id`), push `notifyMessageReceived`, `queueEmailNotification` +
  `pendingEmailNotifications` table column + both email send paths. Without the context
  extension, bundle-thread pushes would be silently skipped ("No notification context").
- Unified inbox renders bundle threads: `posts.getSellerChats`/`getBuyerChats` hydrate
  `bundle: {_id,label,status}`; messages lib gained `isBundleThread`, `ChipRole "bundle"`
  (Phosphor `Package` chip), teal `bg-bundle/10` row thumbnail, `getItemTitle` falls back
  to bundle label; dashboard thread header shows "View bundle" and the composer disables
  with "This bundle is no longer available" when the bundle row is gone.

### Saved bundles — mirrors savedSaleEvents exactly
- `savedBundles` table (`by_user`, `by_user_and_bundle`), `bundles.saveBundle` (toggle) /
  `isBundleSaved` / `getSavedBundles` (drops cancelled/deleted bundles at read time),
  `useSaveBundle` hook (optimistic + pop animation, mirrors `useSaveSaleEvent`), bookmark
  heart in the Deal Ticket band, "Saved Bundles" section in the dashboard Saved tab
  (between Saved Sales and Saved Ads; teal icon tile).
- Ads + whole Sales were already savable — bundles were the only gap (v1 had no page to
  host a save button).

### Feed cap + exchange guard
- `HomePage.displayAds`: bundle members capped at **2 per bundle** on the uncategorised
  feed (sales stay at 3) so a 4-item bundle doesn't yield 5 same-seller cards. Category/
  search stays uncapped (deliberate: "members look like plain listings in search").
- **Bundles are sale-only** (product rule: only standard ads can be trade/exchange):
  `createBundle` throws on `listingType: "exchange"` ("trade-only"); picker reason
  "Trade-only". Rationale: exchange ads have no `price` → `?? 0` corrupts the savings
  math. `"both"` stays eligible (has a price). Moving Sale is safe by construction (its
  wizard hardcodes `listingType: "sale"`).

### Gotcha: `position: fixed` inside `<main>` doesn't pin to the viewport — portal to body
Layout's `<main class="mobile-scroll-container">` sets `contain: layout style paint`
(deliberate scroll-perf CSS, `src/index.css` ~414). `contain: layout` makes `<main>` the
containing block for `position: fixed` descendants, so an inline fixed CTA bar SCROLLS AWAY
with the content instead of pinning to the viewport (caught by Amir on the bundle page,
2026-07-05). PublicSaleView/PublicSaleViewEditorial already knew this — their footer CTAs
are `createPortal(..., document.body)` with a comment citing "same escape hatch as
AdDetail's mobile FABs". `PublicBundleView` initially missed the portal when mirroring;
fixed. **Rule: any viewport-fixed element rendered under `<main>` must portal to
`document.body`.** (The BottomNav is a sibling of `<main>`, so `bottom-[var(--bottom-nav-height)]`
offsets still line up after portaling.)

### /simplify pass on v2 (same day) — shared helpers extracted
4 parallel review agents (reuse/simplification/efficiency/altitude) over the v2 diff:
- **`src/hooks/useSaveToggle.ts`** — the optimistic bookmark toggle (optimistic state,
  toast copy, reduced-motion pop animation) extracted from the identical
  `useSaveSaleEvent`/`useSaveBundle` bodies; both are now thin wrappers binding their
  Convex queries. Also gates the `getCurrentUser` subscription on `isAuthenticated`
  (anonymous public-page visitors no longer open it). Next savable entity = ~10 lines.
- **`src/lib/share.ts` `sharePage(title)`** — native-share/clipboard fallback extracted
  from the verbatim copies in `PublicSalePage` + `PublicBundlePage`.
- **`BundleMessageModal` composes from the shared chat library** — `MessageBubble` +
  `MessageComposer` from `src/features/messages/` replace the hand-rolled bubbles/composer
  (honors the "never hand-roll chat UI" rule). Bubbles are brand-primary like every other
  chat surface; only the modal SHELL mirrors SaleMessageModal. Scroll lock now uses the
  shared `useScrollLock` (iOS-aware) instead of raw `body.overflow`.
- **`UserDashboard`**: per-kind thread facts (`viewItemLabel` / `onViewItem` / composer
  disabled+reason) computed once in a `threadMeta` object next to `activeIsSale`/`activeIsBundle`
  — the four parallel 3-way ternary chains in JSX collapsed to property reads. Saved-tab
  Sales/Bundles rows share a local `SavedGroupRow` component.
- **`posts.getSellerChats`/`getBuyerChats`**: per-chat hydration (ad/sale/bundle/counterpart/
  latestMessage/unread) now runs in one `Promise.all` — the chain was fully sequential and
  grew by one await per thread kind.
- **Payload trims**: `getPublicBundle` dropped unused `createdAt`/`condition`;
  `getSavedBundles` returns only what the Saved-tab card renders (label/status/price/count).
- **`BundleBanner.onBannerClick` made required** — sole caller always passes it; killed 5
  conditional attribute expressions.
- `HomePage.displayAds` sale/bundle caps share one `underCap` helper + composite-key map.
- `sendBundleMessage` skips the redundant `lastMessageAt` patch on first-message chat creation
  (insert already sets it). NOTE: `saleChats.ts` still has the copied redundant patch — left
  alone (shipped file).

**Reviewed and deliberately skipped** (follow-ups if the area is touched again):
- Notification chain: `bundleId` is threaded as a third optional per-kind arg through 4
  signatures + a `pendingEmailNotifications` column. The deeper fix is deriving the kind
  from the `chats` row via the existing `chatId` arg in `getChatNotificationContext` —
  would remove all per-kind args and the silent-skip failure mode for future kinds, but
  touches shipped ad/sale notification callers. Do this when adding a 4th thread kind.
- `convex/lib/chatThread.ts` (shared send-thread + notify fan-out for messages/saleChats/
  bundleChats) — right mechanism, but unifying 3 files incl. shipped ones is its own change.
- Shared `ThreadModal` (SaleMessageModal shell minus chips) — revisit when SaleMessageModal
  is next touched; the composer/bubble reuse already captured most of the win.
- Test-infra dedup (`loadConvexModules` ×5, framer-motion mock ×2) — established convention.

### Tests
- `convex/bundles.test.ts` grew getPublicBundle / saved-bundles / exchange-guard suites;
  `convex/bundleChats.test.ts` (new, mirrors saleChats.test.ts incl. the scheduled-push +
  pending-email assertions); `PublicBundleView.test.tsx` covers active/partial/sold/owner
  states. Full suite 558 tests + `npm run lint` clean.
- Gotcha: test inserts into `saleEvents` need `status` from the draft/active/ended union
  and required `createdAt` — "published" is not a valid status literal.
