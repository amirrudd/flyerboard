# Boost to Top — Feature Plan (v2, review-hardened)

**Status:** Plan approved-pending-review. Not implemented.
**Created:** 2026-07-09. **v2 2026-07-09:** amended after two adversarial reviews (edge-case pass + simplicity/architecture pass) — see "Review changelog" at the bottom. **v2.1 2026-07-09:** name **CONFIRMED by founder: "Boost"** ("Repin" considered and passed on); boost animations added to Phases 2 & 3.
**Name:** **Boost** (decided — see "Naming").

Each phase below is self-contained and executable in a fresh chat context. Every phase cites the exact files/lines to copy from — **read the cited sources before writing code; do not work from memory.**

---

## Phase 0 — Consolidated Discovery (DONE — read this, don't redo it)

### What the feature is

FlyerBoard's feed is *always* newest-first (no sort control, by design). New ads push old ads down. Boost lets an ad's owner push their existing ad back to the top of the feed — but only after a cooldown has elapsed since listing (or since the last boost). Pricing (free-once vs. paid-from-start) is deliberately deferred; the plan builds the entitlement seam without committing to a price.

### Prior discussion found in the repo (the "hook" already exists)

- `src/content/terms-and-conditions.md:60` — *"If you choose paid features (e.g., 'boost' or 'pin to top'), you agree to the applicable pricing and payment terms. All fees are non-refundable except as required by law."*
- `src/content/privacy-policy.md:18` — *"**Transaction Data:** Information related to any fees paid for 'boost' or other paid Platform features."*
- `docs/architecture/design-decisions.md:3-13` — feed is always newest-first **because** "The core product loop and monetization is 'pin your flyer to the top.'"
- `docs/plan.md:297-302`, `src/hooks/useAdFilters.ts:4-6`, `src/pages/HomePage.tsx:47` — same rationale repeated.
- **No dedicated spec for this feature existed anywhere in the repo** — this document is the first one.

### Load-bearing technical facts (verified with file:line)

1. **The feed sorts on Convex's immutable `_creationTime`.** `convex/ads.ts:81-105` (`getAds`) orders `desc` on the built-in `by_creation_time` index; `getLatestAds` (`convex/ads.ts:218,262`) uses `.gt("_creationTime", sinceTimestamp)`. `_creationTime` **cannot be patched** — boosting requires a new mutable sort field (`bumpedAt`) + a custom index + query rewrites.
2. **`ads` schema** (`convex/schema.ts:15-50`) has no mutable sort timestamp today. Indexes at `schema.ts:41-46`; search index `search_ads` at `:47-50`.
3. **There are SIX `insert("ads")` sites, not one**: `convex/posts.ts` (`createAd`), `convex/saleEvents.ts:258-271` (Moving Sale items), and seeds `convex/seed.ts:230,345`, `convex/sampleData.ts:353`, `convex/seedTestAd.ts:41`. All must set the new sort field.
4. **Client interleave**: `src/features/ads/AdsGrid.tsx:103-122` merges ads (`sortKey: ad._creationTime`), sale cards (`sale.createdAt`), bundle cards (`bundle.createdAt`) and sorts desc by `sortKey`.
5. **Feed data owner**: `src/context/MarketplaceContext.tsx:83-94` freezes `maxCreationTime` at mount for `usePaginatedQuery(api.ads.getAds)`; fresh ads accumulate via `freshAdsRef` (`:66-70,130-154`); `knownAdIds` dedupe at `:133-134`; rebuild effect `:170-180`; `refreshAds` fires only on `visibilitychange` + forced post-posting navigation (`HomePage.tsx:150-169`), throttled 60 s. **This design is currently safe only because the sort key is immutable** — see Phase 2.
6. **`getAds` has a second caller**: `src/features/layout/CommandPalette.tsx:46` (search branch only, passes no `maxCreationTime`) — check it when renaming args; "single caller" is false.
7. **Canonical mutation pattern**: `convex/posts.ts:98-165` (`updateAd`) — `getDescopeUserId` → `checkRateLimit` → existence → ownership → `ctx.db.patch` → `logOperation`. Soft-delete convention at `posts.ts:207-211`.
8. **Rate limiting**: add a key to `RATE_LIMITS` (`convex/lib/rateLimit.ts:21-47`), call `checkRateLimit(ctx, userId, "op")` (`:65-111`). Note: Convex mutations are transactional — a mutation that throws after `checkRateLimit` rolls the rate-limit row back, so only *successful* operations consume budget.
9. **Monetization stub precedent**: `convex/saleEvents.ts:475-500` (`purchaseAddon`) — "STUB — real flow opens Stripe Checkout". Entitlements inline on the row. **No Stripe SDK, no payments table.** The existing `pinnedUntil` (7-day *search* pin, `schema.ts:207`) is written but never read by any query — NOT a feed-ordering precedent.
10. **Per-card dashboard action pattern to copy**: "Add to a bundle" IIFE at `src/features/dashboard/UserDashboard.tsx:1114-1150` (eligibility at `:1133`: `!ad.isSold && !ad.bundleId && !ad.saleEventId`). `getUserAds` (`posts.ts:255-261`) returns **full ad docs**, so new schema fields reach the dashboard with no query change.
11. **`by_category` index has another consumer**: `convex/admin.ts:96` (`getFlyers`) — changing the index reorders the admin moderation list (accepted; see decisions).
12. **Migrations**: run via `npx convex run migrations:<name>`. Batch-cap pattern: `convex/imageCleanup.ts:13-25,34`.
13. **Notification seams** (v2): `convex/notifications/emailNotifications.ts`, `pushNotifications.ts`, cron registration `convex/crons.ts:7-20`.
14. **Convex index semantics relied on** (verify once on dev before Phase 1B — 2-minute test): (a) documents missing an optional indexed field sort *below* all defined values under `.order("desc")`; (b) a reactive paginated query drops a doc when a patch moves its indexed key out of the scanned range.

### Allowed APIs (cite-verified — do not invent others)

- `getDescopeUserId(ctx)` from `convex/lib/auth.ts:11-27`
- `checkRateLimit(ctx, userId, operation)` from `convex/lib/rateLimit.ts:65`
- `ctx.db.patch(id, {...})`, `ctx.db.query("ads").withIndex(...)`, `.order("desc")`, `.paginate(...)` — exactly as used in `convex/ads.ts` / `convex/posts.ts`
- Convex function syntax: object form with `args`/`returns`/`handler` per `.cursor/rules/convex_rules.mdc` (include `returns` on all NEW functions even though older neighbors omit it)
- `formatDistanceToNow` from `date-fns` (pattern: `src/features/ads/AdDetail.tsx:462-464`)
- `useMotionPrefs()` helpers for any animation (`src/hooks/useMotionPrefs.ts`)

### Anti-patterns (global — every phase must respect these)

- ❌ **Never patch or rely on patching `_creationTime`** — immutable in Convex.
- ❌ **Never delete + re-insert the ad row** — breaks `_id` references (chats, savedAds, reports, bundles).
- ❌ **Never add a sort control to the feed** — documented product decision; Boost only works because feed order is fixed.
- ❌ **Never enforce eligibility client-side only** — the mutation re-checks everything server-side.
- ❌ **Never ship the query rewrite in the same deploy as the schema change** — see the two-deploy sequence (Phase 1A/1B). Doing it atomically sinks every pre-existing ad to the bottom of the live feed until backfill completes.
- ❌ Don't copy `.agent/skills/convex-utility/examples/standard-mutation.ts` literally — stale import path (`convex/authUtils` → actual `convex/lib/auth`) and a nonexistent `updatedAt` field.
- ❌ Don't forget soft-delete filters (`isDeleted !== true`) on any new/changed query; don't add NEW `.filter()`-based logic where an index works (`convex_rules.mdc:228`).
- ❌ Don't gate UI auth state on a Convex query — use Descope `useSession()` + `useUserSync()` (CLAUDE.md).

---

## Naming — the hook

**DECIDED (founder, 2026-07-09): "Boost" is the feature name; "Boost to top" is the CTA verb phrase.** "Repin" was seriously considered (most on-brand with the board metaphor, pairs with "Pin Your Flyer") but passed on for now: "pinned" implies permanence the feature doesn't deliver, Pinterest owns the word colloquially, and it would collide with the stubbed 7-day search-pin add-on. Revisitable pre-launch at copy-only cost.

| Candidate | Verdict | Why |
|---|---|---|
| **Boost** | ✅ **Recommended** | Already reserved verbatim in Terms & Privacy as a paid feature — zero legal-copy changes. Industry-standard, instantly understood, verb-able. |
| Pin to top | ❌ | "Pin" is the *posting* metaphor ("Pin Your Flyer") and the stubbed 7-day *search* pin add-on. A third meaning would collide. |
| Bump / Refresh | ❌ as brand | Generic; "Refresh" collides with `refreshAds()`. Use `bumpedAt` as the *internal field name* only. |
| Re-pin | ❌ | Inherits both "pin" collisions. |

Internal naming: field `bumpedAt`, mutation `boostAd`, rate-limit key `boostAd`, constant `BOOST_COOLDOWN_MS`. UI copy uses "Boost".

---

## User journeys & why this is the flagship upsell

### Journeys

1. **Aging-ad seller (core journey).** Sara listed a couch 10 days ago; it's on page 3. Dashboard → My Ads → her card shows an enabled **"Boost to top"** button. One tap → confirm sheet ("Push this flyer back to the top of the board?") → **the card visibly "launches"** (spring lift + primary-colored ring pulse + an arrow that floats up and fades) → success toast ("Your flyer is back on top"). Her ad now leads the feed for new visitors and **drops onto the board with a pin-flyer settle animation** for current browsers via the fresh-ads rail. The animation is the payoff — it's what makes Boost feel worth paying for later.
2. **Not-yet-eligible seller (anticipation journey).** Tom listed yesterday. His card shows a disabled state: "Boost available in 6 days". Teaches the mechanic, creates a return visit.
3. **Ad-detail owner journey.** Owner views their own ad → same Boost CTA/countdown near the owner actions, same eligibility source of truth.
4. **Browser/buyer journey (integrity).** Buyers see one feed, still strictly sort-date-ordered. A boosted ad surfaces at top **without** the "New" badge (it isn't new — see decisions), and its detail page still honestly says "Posted X ago". No sponsored lane, no feed pollution. A per-user daily boost cap prevents one seller flooding the top.
5. **Re-engagement nudge (v2).** 7 days after listing with no boost and ad still active+unsold: one email/push — "Your couch has slipped down the board. Boost it back to the top."
6. **Upsell journey (later, pricing decided).** First boost free → on a later boost, the confirm sheet becomes the purchase sheet (mirrors `purchaseAddon`). `boostCount` on the ad row makes "first one free" trivially enforceable server-side.

### Why it's a strong feature & upsell

- **The product was architected for it.** Newest-first-no-sort exists *so that* top-of-feed position is scarce and valuable. Boost is the purest monetization of that scarcity.
- **Fits the documented monetization philosophy**: "core usage free, paid add-ons on distribution/visibility" (`design-decisions.md:318-323`).
- **Zero marginal cost, visible value** — views tick up within minutes of a boost.
- **Legal copy is already live** for paid boost.
- **The cooldown + per-user cap keep the feed healthy** — monetization gating and buyer-experience protection are the same mechanism.

### Product defaults chosen (decision seams — see "Open decisions")

- **Cooldown: 7 days** since listing / since last boost. Plain shared constant `BOOST_COOLDOWN_MS` in `convex/lib/boost.ts` (importable by both Convex functions and `src/` — frontend may import from `convex/`, never the reverse). **No env override** — a runtime-tunable value would silently desync the client countdown.
- **Per-user cap: 3 boosts per user per day** via `RATE_LIMITS.boostAd = { maxRequests: 3, windowMs: 24*60*60*1000 }`. This is the anti-flooding gate (cooldown alone is per-ad; a seller with 50 ads could otherwise own the whole top of the feed).
- **v1 is free.** `boostCount` recorded from day one so future pricing needs no migration.
- **Eligibility**: `isActive`, not `isDeleted`, not `isSold`, `!saleEventId`, `!bundleId` (mirrors `UserDashboard.tsx:1133`). Note: `saleEventId` is never cleared in the current codebase, so sale items are permanently boost-ineligible — accepted for v1, documented.
- **No "New" badge and no "Boosted" badge for boosted ads** in v1. The fresh-rail merge distinguishes brand-new ads from re-bumped ones (Phase 2), so only genuinely new ads enter `newAdIds`. This avoids the trust contradiction of a "New"-badged card whose detail page says "Posted 1 month ago" (`AdDetail.tsx:462-464` stays untouched and honest).

---

## Phase 1A — Backend, deploy #1: schema + all insert sites + backfill (queries untouched)

**Goal:** every ad row carries `bumpedAt` (initialized to creation time) before any query reads it. **The feed still sorts on `_creationTime` at the end of this phase.**

### 1A-1. Schema (`convex/schema.ts`)

Add to the `ads` table:
- `bumpedAt: v.optional(v.number())` — epoch ms; the future feed sort key. **Optional is temporary** (required by Convex schema validation while old rows exist); Phase 1B tightens it to `v.number()`.
- `boostCount: v.optional(v.number())` — total boosts; the future-pricing seam.

Indexes:
- New: `.index("by_bumped_at", ["bumpedAt"])`.
- Change `by_category` → **`by_category_and_bumped_at`** on `["categoryId", "bumpedAt"]` (naming per `convex_rules.mdc:185`; update its consumers: `convex/ads.ts` category branches AND `convex/admin.ts:96` — admin list ordering changes to recently-boosted-first, accepted). *If the founder defers category-view boost (decision D4), skip this index change entirely.*

### 1A-2. Shared constant + defaults helper

- `convex/lib/boost.ts`: `export const BOOST_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;` (+ `BOOST_DAILY_CAP = 3` for reference in copy).
- Add a tiny `newAdTimestamps()` helper (or inline consistently): every insert gets `bumpedAt: Date.now(), boostCount: 0`.

### 1A-3. Set `bumpedAt` at ALL SIX insert sites

`convex/posts.ts` (`createAd`), `convex/saleEvents.ts:258-271` (sale items — **missing this silently sinks every future Moving Sale item to the bottom of the feed**), `convex/seed.ts:230,345`, `convex/sampleData.ts:353`, `convex/seedTestAd.ts:41`. Seeds that fabricate aged ads should set `bumpedAt` to the same fabricated age, not `Date.now()`.

Verification grep is mandatory: `grep -rn 'insert("ads"' convex/` — every hit sets `bumpedAt`.

### 1A-4. Backfill migration (`convex/migrations.ts`)

`backfillBumpedAt` internalMutation: patch `{ bumpedAt: ad._creationTime }` where `bumpedAt === undefined` (idempotent guard).
- **Iterate newest-first** (`.order("desc")`) — mid-run, backfilled values rank above still-undefined rows, so newest-first iteration keeps the visible top of the feed correct throughout; oldest-first would surface 2025-era ads on page 1 mid-migration.
- Batch with a cap + cursor loop per `imageCleanup.ts:17-19,34`; each `npx convex run migrations:backfillBumpedAt` processes one batch and reports remaining. Run to completion at low traffic.

### Verification checklist (Phase 1A)

- [ ] Deploy; run backfill to completion; in Convex data browser confirm **zero** ads with `bumpedAt === undefined`.
- [ ] One-off dev check of Phase 0 fact #14 (undefined-ordering + reactive-drop semantics) — record the result in the PR description.
- [ ] Feed behavior unchanged (queries untouched). `npm run lint`.
- [ ] Vitest: inserts via `createAd` and sale-item creation set `bumpedAt`/`boostCount`.

### Anti-pattern guards (Phase 1A)

- Do not touch `getAds`/`getLatestAds` in this deploy.
- Do not skip any insert site; do not let seeds produce undefined `bumpedAt`.

---

## Phase 1B — Backend, deploy #2: query switch + `boostAd` + tighten schema

**Goal:** feed orders by `bumpedAt`; owners can boost; the optional-field footgun is closed.

### 1B-1. Feed queries (`convex/ads.ts`) — all FOUR bound sites

- `getAds` default branch (`ads.ts:84`): `withIndex("by_bumped_at", q => q.lte("bumpedAt", args.maxSortTime || Date.now())).order("desc")`.
- `getAds` category branch **post-filter** (`ads.ts:100-102`): the `_creationTime ≤ max` filter → `bumpedAt ≤ max`; index → `by_category_and_bumped_at`.
- `getLatestAds` default branch (`ads.ts:262`): `.gt("bumpedAt", sinceTimestamp)`.
- `getLatestAds` category branch **post-filter** (`ads.ts:278-280`): → `bumpedAt > since`.
- Rename arg `maxCreationTime` → `maxSortTime`; update callers: `MarketplaceContext.tsx:85-94` (real) and confirm `CommandPalette.tsx:46` (search-only, passes none — type-check only).
- Search branch (`ads.ts:54-80`) unchanged. Preserve every existing filter (`isActive/isDeleted/isSold`, `ads.ts:95-103`).

### 1B-2. Tighten schema

`bumpedAt: v.number()` (required — backfill guaranteed no undefined rows). **Remove every `?? _creationTime` fallback** this makes possible. Rationale: any future insert path that forgets the field must now fail schema validation loudly instead of silently sinking the ad.

### 1B-3. `boostAd` mutation (new, in `convex/posts.ts`)

Copy the `updateAd` skeleton (`posts.ts:98-165`), with `returns: v.null()`:
1. `getDescopeUserId(ctx)` → throw if unauthenticated.
2. `checkRateLimit(ctx, userId, "boostAd")` — register `boostAd: { maxRequests: 3, windowMs: 24*60*60*1000 }` in `RATE_LIMITS` (this is the per-user daily anti-flooding cap; transactional rollback means only successful boosts consume it).
3. Load ad; throw if missing or `isDeleted`.
4. Ownership: `existingAd.userId !== userId` → throw (style: `posts.ts:124-126`).
5. Eligibility (authoritative): `isActive === true`, `isSold !== true`, `!saleEventId`, `!bundleId`; cooldown `Date.now() - ad.bumpedAt >= BOOST_COOLDOWN_MS` → else throw an error naming the remaining wait.
6. `ctx.db.patch(adId, { bumpedAt: Date.now(), boostCount: (ad.boostCount ?? 0) + 1 })` + `logOperation` (`posts.ts:150-162`).
7. **Pricing seam (folded former Phase 4):** compute `isFirstBoost = (ad.boostCount ?? 0) === 0`; allow regardless for now, with a single stub-style docblock mirroring `saleEvents.ts:472-474` — when pricing lands, non-first boosts route through checkout here. Build **no** payments table/Stripe/purchase UI now.

**No `getBoostEligibility` query.** `getUserAds` already returns full docs; the dashboard computes countdowns from `ad.bumpedAt` + imported `BOOST_COOLDOWN_MS`. (Cut per review — the constant is code-shared, so client display can't drift; the server remains authoritative.)

### Verification checklist (Phase 1B)

- [ ] Vitest: boost happy path; rejects non-owner; rejects before cooldown (boundary: exactly at cooldown = allowed); rejects sold/deleted/bundled/sale ads; increments `boostCount`; 4th boost in a day rate-limited; feed query returns boosted ad first; legacy-aged ad (old `bumpedAt`) is immediately eligible.
- [ ] `grep -n "by_creation_time" convex/ads.ts` → no remaining uses in `getAds`/`getLatestAds`.
- [ ] `grep -rn "bumpedAt ?? " convex/ src/` → zero fallbacks remain.
- [ ] `npm run lint`.

### Anti-pattern guards (Phase 1B)

- Do not attempt `ctx.db.patch(id, { _creationTime: ... })`.
- Do not leave `bumpedAt` optional "to be safe" — the fallback is the bug.
- Do not use `getAuthUserId` from `convex/auth.ts` — Descope path is `getDescopeUserId`.

---

## Phase 2 — Frontend feed plumbing: the RISKIEST phase (read this spec fully)

**Goal:** boosted ads surface live in open sessions, never vanish, never duplicate.

**Why this is dangerous:** today the frozen-bound design (`maxCreationTime` frozen at mount) is safe because the sort key is immutable. Once `bumpedAt` is mutable, a boost pushes an ad **above the frozen bound**, so the reactive paginated query *ejects* it from every open session. Recovery must come from the fresh-ads rail — but the current `knownAdIds` dedupe (`MarketplaceContext.tsx:133-134`) *drops* any `getLatestAds` result whose `_id` is already known, and the watermark then advances past the boost (`:154`). As written today, this reproduces the `8cf9b00`-class "disappearing ads" bug: **a boosted ad silently vanishes from open feeds, possibly permanently for that session.** The two-window manual test hides this (window-switch fires `visibilitychange`); same-tab viewers are the victims.

### 2-1. `AdsGrid.tsx` sortKey

`src/features/ads/AdsGrid.tsx:103-122`: ad entries → `sortKey: ad.bumpedAt` (required field after 1B — no fallback). Sale/bundle entries unchanged.

### 2-2. `MarketplaceContext.tsx` — bumpedAt-aware merge (extend `freshAdsRef`, do NOT rewrite it)

1. Frozen bound: rename to `maxSortTime` (matches 1B-1); still frozen at mount — semantics remain coherent: "fresh rail = anything whose sortKey moved past mount time" now uniformly covers created AND boosted ads.
2. **Replacement-aware dedupe:** in `refreshAds` (`:130-154`), for each `getLatestAds` result: if `_id` is unknown → brand-new, add to `freshAdsRef` AND `newAdIds` (New badge). If `_id` is already known but the returned `bumpedAt` is **newer** than the held copy → it's a boost: put the new copy in `freshAdsRef` as a replacement and rely on the rebuild merge (`:170-180`) to drop the stale copy from `ads` results by `_id` — **do not add it to `newAdIds`** (no New badge for boosts, see decisions).
3. **Watermark fix:** advance the `sinceTimestamp` watermark to `max(bumpedAt of merged results)`, **not** `Date.now()` (`:154`) — otherwise a boost that races a re-emitting paginated query is skipped once and unrecoverable for the session.
4. **Visible-tab recovery:** `refreshAds` currently fires only on `visibilitychange`/forced navigation (`HomePage.tsx:150-169`). Add a gentle interval tick (60 s, matching the existing throttle, only while tab visible) so an actively-scrolling user's feed recovers boosted ads without a tab switch.
5. **Post-boost actor refresh:** after a successful `boostAd` mutation (Phase 3), invoke the forced-refresh path (same mechanism as post-create, `HomePage.tsx:162-169`) so the booster sees their ad jump.
6. **Known accepted limitation (document in code comment):** `freshAdsRef` entries are one-shot snapshots — a boosted ad that is then sold/edited stays stale at feed top until remount/refresh. Pre-existing behavior, now slightly more exposed; revisit only if reports surface.

Read the `freshAdsRef` accumulation code and its comments in full before editing — it is a hard-won fix (commit `8cf9b00`); extend, never rebuild.

### 2-3. Feed-arrival animation — "pin drop" (on-brand: a flyer being pinned onto the board)

All motion goes through `useMotionPrefs()` (`src/hooks/useMotionPrefs.ts`) — **add a new `boostPinDrop` helper there** alongside `fadeUp`/`staggerCard`, so `prefers-reduced-motion` stays baked in centrally (reduced-motion users get a plain fade or nothing; do NOT add manual media-query checks in components). Canonical usage pattern: `src/features/ads/AdsGrid.tsx`.

- When the merge classifies an entry as a **re-bumped replacement** (Phase 2-2.2), its card mounts at the top with the pin-drop variant (UX-consultant-refined, 2026-07-09 — note these are the codebase's FIRST springs; `useMotionPrefs` is all tweens today): initial `{ opacity: 0, y: -14, scale: 1.06 }` → settle to rest with `type: "spring", stiffness: 260, damping: 22, mass: 0.9` (~4% overshoot "thunk"; **no rotate** — it reads as misalignment on a rectangular grid card). Under `reduced`: plain `opacity` fade 0.2 s.
- **Ring pulse = an opacity-animated overlay, NOT border/box-shadow:** sibling `<div className="absolute inset-0 rounded-2xl ring-2 ring-primary pointer-events-none">` animating **opacity 0.6 → 0 over ~1.2 s** (compositor-only; animated borders shift layout and animated box-shadow janks a 30-card mount). The pulse is the transient "look here" cue that replaces the New badge boosted ads deliberately don't get.
- **Existing cards sliding down:** framer-motion `layout` (within `LayoutGroup`) **desktop only — ship mobile WITHOUT `layout`** (cards reflow instantly; only the arriving card animates). Enable more broadly only after a throttled mid-tier profile shows no jank. Brand-new ads may reuse the same entrance or keep their current treatment — implementer's call, one variant preferred.
- The pulse triggers once per boost event (key it on `${ad._id}:${ad.bumpedAt}` so a second boost days later re-animates, but re-renders/remounts don't).

### Verification checklist (Phase 2)

- [ ] **The same-tab test (the one that matters):** window A dashboard, window B feed **kept visible and untouched** (no tab switch); boost in A → within ~60 s B shows the ad at top, exactly once, no New badge. Also verify the ad never disappears from B in the interim.
- [ ] Two-window switch test (visibilitychange path) still passes.
- [ ] Category-filtered feed: boosted ad rises there too (if D4 accepted) and via fresh rail.
- [ ] Vitest for the merge: brand-new vs re-bumped classification, watermark = max merged `bumpedAt`, no duplicate `_id` after rebuild.
- [ ] Animation: pin-drop plays once on arrival (and again only on a later boost); with `prefers-reduced-motion` emulated (DevTools rendering panel) it degrades to a fade/none; no jank on a mid-tier mobile viewport with 30+ cards (drop `layout` if so).
- [ ] `npm run dev` from the worktree dir with `.env.local` copied (known gotcha). `npm run lint`.

### Anti-pattern guards (Phase 2)

- Don't rebuild `freshAdsRef` from scratch; don't dedupe by `_id` alone (must compare `bumpedAt`); don't advance the watermark to `Date.now()`.
- Don't introduce any client-side sort *control*.

---

## Phase 3 — Dashboard & ad-detail CTA

**Goal:** owners can boost from My Ads and see the countdown when ineligible.

0. **UX consultant decisions (2026-07-09) — binding for this phase:**
   - **Placement:** Boost goes in the card's ACTION ROW (`UserDashboard.tsx:1160`, `flex items-center gap-2 justify-end`) as the **leftmost item with `mr-auto`** (hero left / utilities right), NOT next to the low-key "Add to a bundle" pill. It is the **only filled-primary element on the card** (recipe: the empty-state button at `:1067` — `rounded-full bg-primary text-primary-foreground font-semibold shadow-sm shadow-primary/25 hover:bg-primary/90 active:scale-[0.98]`). Label visible at ALL breakpoints (utilities stay icon-only on mobile); lucide `ArrowUp` 16 px. Touch target `h-11 md:h-9` (the hero action must clear 44 px on mobile even though the utilities don't). Add `flex-wrap` to the row as a narrow-viewport safety valve.
   - **Copy (paste-ready):** button `Boost to top`; cooldown state `Boost in 3d` (days when ≥24 h remain, hours in the final day — never a stale "1d" all day); modal title `Boost this flyer?`; body `This pushes your flyer back to the top of the board, so it's the first thing people see again. It's free — you can boost again in {N} days.` (**"It's free" is load-bearing** — Terms already mention paid boost, users will hesitate; `{N}` renders from the reactive config value, never a literal); confirm `Boost to top` styled `bg-primary` (NOT the delete modal's destructive red); cancel `Not now`; success toast `You're back on top of the board 🎉`.
   - **AdDetail:** in the desktop Quick Actions card (`AdDetail.tsx:797`), Boost becomes the primary and **Edit is demoted to secondary** (Save/Report recipe at `:812`) — never two filled-primary buttons stacked. **Mobile gap (mandatory):** Quick Actions is `hidden sm:block`; add Boost to the mobile FAB portal set (offset `bottom-[var(--bottom-nav-height)]` per ui-patterns.md BottomNav gotcha) or mobile owners cannot boost from the detail page. Verify the FAB stack contents before building.
1. **Copy the per-card action pattern for eligibility gating**: "Add to a bundle" IIFE at `UserDashboard.tsx:1114-1150` (return `null` when state-ineligible). The button itself lives in the action row per item 0:
   - Eligible (client-computed from `ad.bumpedAt` + imported `BOOST_COOLDOWN_MS` + state checks — display only; server re-checks) → primary button → confirm modal (pattern: `showDeleteConfirm`, `:1675`) → `useMutation(api.posts.boostAd)` → success toast "Your flyer is back on top." → forced feed refresh (Phase 2-2.5).
   - **Disable the button immediately on tap** (double-tap protection — Convex OCC makes the second call fail correctly, but the user shouldn't see success-then-error toasts).
   - Ineligible by cooldown → disabled "Boost in Xd" (`date-fns`, pattern `AdDetail.tsx:462-464`).
   - Ineligible by state (sold/bundled/in-sale/inactive) → render nothing.
2. **Ad detail (owner view)**: same CTA in the owner-actions area of `AdDetail.tsx`, computed from the same doc fields + shared constant (no per-surface hardcoded "7").
3. The buyer-facing "Posted {timeAgo}" on `AdDetail.tsx:462-464` stays as-is (honest creation date).
4. **Success animation — "launch" (the owner's payoff moment).** Add a `boostLaunch` helper to `useMotionPrefs()` (same file as `boostPinDrop`, Phase 2-3 — reduced-motion baked in, no new animation libraries, no confetti deps). On mutation success, sequence on the dashboard card:
   1. Button content swaps to a check + "Boosted!" (state change, no motion needed).
   2. Card lift: spring `y: [0, -10, 0]` with a `boxShadow`/ring pulse in the primary token (~600 ms) — the card visibly "jumps."
   3. A single lucide `ArrowUp` (`motion.span`) floats up from the button (`y: -24, opacity: → 0`, ~500 ms) and unmounts (`AnimatePresence`).
   4. Success toast: "Your flyer is back on top."
   5. Button settles into the disabled countdown state ("Boost in 7d").
   Icon sizes 16/20/24 px per design tokens; keep total sequence under ~1 s so it never feels like it's blocking. UX refinements (binding): the card lift is a **tween keyframe** `{ y:[0,-10,0], transition:{ duration:0.5, ease:[0.2,0.8,0.2,1], times:[0,0.4,1] } }` reusing the existing `EASE` (a spring on a keyframe array can undershoot the return); ring pulse uses the same opacity-overlay technique as `boostPinDrop` (never animated box-shadow); ArrowUp float `{ y:[-4,-24], opacity:[1,0] }` 0.5 s in `AnimatePresence` with `will-change: transform`.
5. Copy tone: casual house voice; design tokens only (`bg-primary`, no hardcoded hex).
6. Error surface: mutation throws (rate-limit cap / cooldown race) → toast the server message, matching `handleDeleteAd` (`:501`) handling. No animation on failure — the card must not "celebrate" a rejected boost, so gate the launch sequence on the mutation promise resolving.

### Verification checklist (Phase 3)

- [ ] `bash .agent/skills/visual-consistency-auditor/scripts/audit-design-system.sh src/features/dashboard/UserDashboard.tsx` — no new hardcoded values.
- [ ] `bash .agent/skills/responsive-ui-auditor/scripts/audit-responsive.sh` on touched files.
- [ ] Manual: eligible ad boosts; countdown renders; sold/bundled ads show no button; double-tap shows one toast.
- [ ] Animation: launch sequence plays only on success (force a cooldown error and confirm no celebration); reduced-motion emulation degrades gracefully; both new helpers live in `useMotionPrefs.ts` (grep: no `framer-motion` variants defined inline in the dashboard, no `matchMedia` reduced-motion checks in components).
- [ ] `npm run lint`; `npm run test:visual` (note: `e2e/layout.spec.ts:10,24` masks the ads grid, so feed snapshots are safe; no dashboard snapshot exists).

### Anti-pattern guards (Phase 3)

- Client eligibility is display-only; never skip the server re-check.
- Don't fire authed queries before `isUserSynced` (existing `useUserSync()` gating in `UserDashboard.tsx`).

---

## Addendum (v2.2) — Admin-configurable boost settings + feature flag

Founder requirement (2026-07-09): boost activation period (and cap) must be editable from the admin dashboard. This SUPERSEDES the v2 "code constant, no env override" decision — a DB-backed reactive value solves the client-drift problem *better* than a constant. Discovery (verified): `featureFlags` table (`convex/schema.ts:179-184`) + `convex/featureFlags.ts` (public single-key `getFeatureFlag:24-34` with NO admin gate; admin-gated `getAllFeatureFlags/create/update/delete` with `logAdminAction`) + `src/features/admin/FeatureFlagsTab.tsx` + `src/hooks/useFeatureFlag.ts` is the established pattern; it stores booleans only. Admin tab wiring = 4 edits in `src/features/admin/AdminDashboard.tsx` (state union `:27`, import `:20`, tabs array `:109-116`, render switch `:158-163`). Canonical admin mutation: `convex/admin.ts:327-364` (`requireAdmin` first → patch → `logAdminAction` → return). Numeric-edit form template: `src/features/admin/CategoriesTab.tsx` (`formData` state `:57`, controlled inputs `:301-322`).

**Design (decided by feature owner):**
1. **New `appSettings` table** mirroring `featureFlags`: `{ key: v.string(), value: v.number(), description: v.string() }` + `by_key` index. New `convex/appSettings.ts` mirroring `featureFlags.ts`'s split: public `getSetting(key)` (reactive, no gate) returning `value ?? null`; admin-gated `getAllSettings` / `updateSetting` (+ optional create/delete) with `logAdminAction`. Server-side clamping on write AND read (cooldown 1–30 days, cap 1–20/day) per the `imageCleanup.ts:21-25` clamp style.
2. **Keys**: `boostCooldownDays` (default 7), `boostDailyCap` (default 3). Seed via a migration mirroring `seedFeatureFlags` (`convex/migrations.ts:404-445`). Code defaults in `convex/lib/boost.ts` remain the fallback when a key is missing.
3. **`boostAd` reads the settings server-side** (authoritative): cooldown from `appSettings`; the daily cap becomes a **custom check inside `boostAd`** (count boosts in last 24 h — NOTE: `RATE_LIMITS` is a static compile-time table (`rateLimit.ts:21-47`), so a DB-configurable cap cannot live there; keep a static `boostAd` entry only as a generous abuse backstop, e.g. 20/day, and enforce the real configurable cap in-mutation, e.g. via a `lastBoostTimestamps`-style count or a small indexed query on ads by user + bumpedAt window — implementer proposes, owner reviews).
4. **Client countdown** reads `boostCooldownDays` via a `useAppSetting(key)` hook mirroring `useFeatureFlag.ts` — reactive, so admin changes propagate live; no drift.
5. **Feature flag**: add `boostToTop` to the existing `featureFlags` seed; ALL boost UI (dashboard CTA, AdDetail CTA) gates on `useFeatureFlag("boostToTop")` exactly like `bundleListing` (`UserDashboard.tsx:144`). `boostAd` mutation also checks the flag server-side (fail closed if flag disabled). Ship dark, flip when ready.
6. **Admin UI (UX consultant, binding)**: a new **"Settings" tab** (id `"settings"`, not "Boost" — future numeric config needs a home) appended at `AdminDashboard.tsx:109-116` + the other 3 wiring spots. Form recipe from `FeatureFlagsTab.tsx:135-160` (uppercase micro-labels, `h-11 px-4 bg-muted/50 rounded-full` inputs, `bg-primary` Save). Controls: **Boost cooldown** `type="number"`, suffix "days", range 1–30, default 7 (stored as days, converted to ms server-side); **Daily boost cap** `type="number"`, suffix "boosts per user / day", range 1–20, default 3. Clamp client-side (disable Save + inline `text-destructive` helper) AND server-side (mutation rejects out-of-range). Under the cooldown field: note "Changes apply immediately — in-progress countdowns recompute live."

## Phase 4 — (folded into Phase 1B step 7)

The pricing seam is `boostCount` (written in 1A/1B) + the stub docblock in `boostAd`. Nothing else to build. Legal copy needs no change for a free launch ("*If* you choose paid features…").

---

## Phase 5 (v2, separate release) — Boost-eligibility nudge

- Daily cron in `convex/crons.ts` (copy `crons.ts:15-20`) → internalMutation scanning active, unsold, cooldown-elapsed, un-nudged ads (stamp `boostNudgedAt`, mirroring the `imagesPurgedAt` pattern) → batched email path (`pendingEmailNotifications`) + optional push.
- Copy: "Your flyer has slipped down the board. Boost it back to the top."
- One nudge per ad per cooldown window. Ship only after v1 telemetry (boost usage, `boostCount` distribution) looks healthy.
- Verification: cron visible in Convex dashboard; dry-run returns expected candidates; idempotent on repeat runs.

---

## Phase 6 — Final verification & knowledge write-back

1. **Full gate:** `npm run lint`, `npm run coverage`, `npm run test:visual`.
2. **Anti-pattern greps:**
   - `grep -rn 'insert("ads"' convex/` — every site sets `bumpedAt`.
   - `grep -rn "bumpedAt ?? " convex/ src/` — zero fallbacks (field is required).
   - `grep -rn "_creationTime" convex/ads.ts convex/posts.ts` — reads only where intentional; no writes.
   - `grep -rn "sort" src/hooks/useAdFilters.ts` — still no sort control.
   - `grep -rn "isDeleted" convex/ads.ts` — soft-delete filters intact.
   - New functions use `args`/`returns`/`handler` object form.
3. **End-to-end proof (verify workflow):** boost an aged seeded ad; observe it lead the feed in a second, *visible, untouched* session; cooldown blocks immediate re-boost; 4th boost of the day across ads is rate-limited.
4. **Abuse-register check (documented, accepted for v1):** delete→repost bypasses the cooldown (costs the seller views/chats; becomes a pricing leak only when boost is paid — revisit in Phase 4-pricing); launch-day thundering herd (every aged ad instantly eligible — acceptable one-time scramble, fresh-rail `take(50)` cap at `ads.ts:227` may truncate the rail briefly).
5. **Write-back (required by CLAUDE.md):**
   - `.agent/gatheredContext/infrastructure/database.md` — `bumpedAt` is *the* feed sort key (required field; `_creationTime` is display-only), index changes, two-deploy migration pattern; bump Last Updated.
   - `.agent/gatheredContext/frontend/state-management.md` — the bumpedAt-aware fresh-rail merge (replacement vs brand-new, watermark rule).
   - `.agent/gatheredContext/meta/features-map.md` — Boost inventory.
   - `docs/architecture/design-decisions.md` — "Boost to Top (Jul 2026)": name (legal alignment), `bumpedAt` over re-insert, 7-day cooldown + 3/day cap rationale, free-v1 + `boostCount` seam, no-New-badge decision, category-index decision, nudge deferred.
   - `src/features/dashboard/USER_JOURNEYS.md` — boost journeys.
   - Note for any future "restore deleted ad" mutation: it must consider both `deletedAt` and `bumpedAt` (no restore exists today).

---

## Open decisions for the founder (defaults chosen so work isn't blocked)

1. **Name**: ✅ **DECIDED — "Boost"** (founder, 2026-07-09; "Repin" considered and passed on — see Naming).
2. **Cooldown length**: 7 days, shared code constant (no env override — keeps client countdown honest).
3. **Per-user daily cap**: 3/day default — the real anti-flooding control; tune freely.
4. **Category-view boost**: default = change `by_category` → `by_category_and_bumped_at` so boost works inside category filters too (side effect: admin flyer list orders by recent-boost). Alternative: defer the index change — boost then reorders only the main feed; category views keep creation order. Cheaper, slightly inconsistent.
5. **Pricing**: deferred by design; `boostCount` seam makes "first free, then paid" a follow-up, not a migration.
6. **Badges**: v1 = no "New" and no "Boosted" badge on boosted ads (avoids the "New" card whose detail says "Posted 1 month ago"). Flip either way later.
7. **Sale-member ads**: permanently boost-ineligible in v1 (nothing ever clears `saleEventId` today). If Moving Sales get an "ended" lifecycle later, revisit.

---

## Review changelog (2026-07-09) — v1 → v2

Two parallel adversarial reviews (edge-case pass; simplicity/architecture pass) drove these amendments:

- **[Critical] Vanishing boosted ads**: frozen-bound + `_id`-only dedupe would silently eject boosted ads from open sessions (the `8cf9b00` bug class). Phase 2 rewritten: replacement-aware dedupe, watermark = max merged `bumpedAt`, 60 s visible-tab tick, post-boost forced refresh, same-tab test.
- **[Critical] Missed insert sites**: `bumpedAt` was only set in `createAd`; Moving Sale items (`saleEvents.ts:258`) + 3 seed files would sink to the feed bottom. Phase 1A now enumerates all six sites + grep gate.
- **[Critical] Deploy sequencing**: schema+query in one deploy sinks the live feed pre-backfill. Split into Phase 1A/1B (two deploys).
- **[High] Feed flooding**: per-ad cooldown alone lets a many-ad seller own the top. Added per-user cap (3/day) via `RATE_LIMITS`.
- **[High] Category branches**: all four bound sites (`ads.ts:84,100-102,262,278-280`) now listed; `by_category` consumers audited (`admin.ts:96` ordering change accepted); index renamed per convention.
- **[High] Optional-forever footgun**: `bumpedAt` tightened to required post-backfill; all `?? _creationTime` fallbacks banned.
- **[Med] Migration ordering**: backfill iterates newest-first to avoid mid-run feed scramble.
- **[Med] Trust contradiction**: boosted ads no longer get the "New" badge; `AdDetail` "Posted X ago" untouched.
- **[Med] Cooldown drift**: env-override dropped; single shared code constant imported by both sides. `getBoostEligibility` query cut (`getUserAds` already returns full docs).
- **[Low] Corrections**: `CommandPalette.tsx:46` is a second `getAds` caller; double-tap disable; failed boosts don't consume rate budget (transaction rollback) — cap counts successes; delete→repost bypass + launch thundering-herd logged in the abuse register; former Phase 4 folded into 1B.
- **Verified sound by review** (no change needed): OCC double-boost safety, `updateAd`/`toggleAdStatus`/sold-relist can't be used as free bumps, bundle detach frees eligibility cleanly, e2e snapshots mask the grid, search branch untouched, frozen-bound semantics remain coherent on the new axis.

**v2.1 (2026-07-09):** Name confirmed by founder: **Boost**. Boost animations added per founder request: `boostPinDrop` feed-arrival variant (Phase 2-3 — flyer-pinned-to-board settle + one-time primary ring pulse, replacing the badge boosted ads don't get) and `boostLaunch` dashboard success sequence (Phase 3.4 — card lift + ring pulse + floating ArrowUp + toast). Both live in `useMotionPrefs()` so reduced-motion stays centralized; no new animation dependencies.
