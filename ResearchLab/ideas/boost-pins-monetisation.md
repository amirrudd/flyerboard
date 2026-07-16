# Boost "Pins" — weekly free tier, composite-card boosting & paid-demand capture

- **Status:** Decided (rules locked; implementation pending unified-feed work)
- **Created:** 2026-07-16
- **Last touched:** 2026-07-16
- **Owner:** Amir

## Problem
Boost ("re-pin to top") is the primary monetisation lever, but v1 ships free with no
payment gateway. The unified-feed redesign adds Bundle and Moving Sale cards to the
boostable surface, raising questions the original boost plan
(`.agent/plans/boost-to-top-feature.md`) didn't answer: what happens when a composite
listing (bundle/sale) is boosted, can member ads be boosted individually, and how do
free limits convert into paid demand later. Decided 2026-07-16 via product-analyst +
product-designer agent sessions, reconciled with the existing boost plan.

## Decided rules (supersede/extend the boost plan where they differ)

### Boost semantics — card-only, no cascade
- Boosting any feed card sets **that card's** `bumpedAt` to now. Nothing else moves. Ever.
- Every feed card type (standard ad, Bundle card, Moving Sale card) carries its own
  independent `bumpedAt` — one shared sort key for the unified paginated feed, no
  special cases in the query.
- **Member ads (ads with `bundleId` or `saleEventId`) are permanently ineligible for
  individual boost.** This kills the cheap-proxy exploit (boosting a $5 member to
  surface a whole bundle/sale) at the eligibility gate instead of with pricing
  defences. Boostable surface = standalone ads + composite cards, nothing else.
- No cascade rationale: (analyst) bundle-boost-boosts-members turns a composite boost
  into a 4-for-the-price-of-1.5 bulk discount and invites throwaway-bundle abuse;
  (designer) one purchase moving 3–4 cards to the top makes the board read as captured
  by one seller — poison for trust-first positioning. The composite card already shows
  every member's thumbnail, so boosting it inherently showcases all items in one slot.

### Free tier — weekly pin allowance (replaces the 3/day cap as the primary limiter)
- **3 "pins" per user per week** (admin-configurable). Standard ad boost = 1 pin;
  Bundle/Sale card boost = **2 pins** ("bigger flyer, two pins" — accepted by Amir
  2026-07-16). Integer weights only; no fractional/per-member weighting.
- 7-day per-item cooldown unchanged (admin-configurable 1–30 days).
- Static 20/day abuse backstop stays, even after payments exist.
- Why weekly not daily: 3/day = 21/week is not scarcity — one seller can own the feed
  top all week free. 3/week makes free boosts an allowance, not a utility; the 2-pin
  composite weight pre-anchors the future 1.5× paid premium.

### Paid phase (deferred — no payment gateway yet)
- Model when it ships: free weekly pins stay; **paid boosts bypass the weekly cap
  only** (cooldown always applies). Ad ≈ A$4–6 one-off impulse price; composite card
  = 1.5×. No free member-boost bundling, no paid member add-on (dropped — members are
  ineligible, full stop).
- **Trigger to build payments: measured demand, not a date.** Flip a region when
  cap-hit interest is sustained (analyst heuristic: >20% of active boosters hitting
  the weekly cap two weeks running).
- `boostCount` is recorded per card from day one (already in the boost plan) so any
  "first N free" variant needs no migration.

### Demand capture at cap-hit (v1, pre-payments)
When a user with 0 pins left taps Boost: same bottom-sheet slot, neutral (not red,
not blocking), copy per designer spec:

> **You've used your 3 pins this week** — they come back Monday.
> Some sellers want extra pins before then. We're deciding whether to build it.
> [ **I'd use extra pins** ] [ Not for me ]
> *One tap. No payment, no commitment — just a show of hands.*

- Log BOTH taps (interest + not-for-me) with listing type + weekday — this dataset
  decides when to build the payment gateway.
- After tap: button morphs in place to "✓ Noted — you're on the list. If we build
  extra pins, you'll hear about it first." No new screen, no overpromise.

### UX spec (designer, accepted direction)
- **Vocabulary: "pins", never "slots" or "credits".** The board metaphor does the
  teaching: "3 pins a week" needs no tutorial.
- Slot state = three Phosphor `PushPin` icons (filled = available, outline = used),
  shown top-right of the boost confirm sheet — the only moment it matters. On confirm
  the spent pins animate filled → outline; the animation IS the ledger.
- Confirm-sheet microcopy: ad → "Re-pin to the top … Uses 1 of your 3 weekly pins";
  bundle → "Re-pin the whole bundle — all N items back on top as one flyer. Bigger
  flyer, two pins. … Uses 2 pins — 1 left this week."
- Member-ad Boost button is NOT disabled (dead buttons feel broken) — it opens a slim
  sheet: "This flyer's part of your '{bundle label}' bundle. Bundles get re-pinned
  together — all N items on one flyer. [Re-pin the bundle →] [Cancel]". The rejection
  IS the upsell.
- Dashboard: one inline `📌📌○` indicator in the header, tooltip "2 pins left ·
  renews Monday". No per-listing badges, history lists, or countdowns at v1.
- Boosted cards in the feed get a small "Re-pinned" pushpin micro-badge (never
  "Sponsored") for the boost window; no glow, no other buyer-side change.

## Open questions
- [ ] Exact weekly reset semantics: rolling 7-day window vs. calendar Monday reset
      (designer copy assumes Monday; rolling is fairer but unexplainable — lean Monday).
- [ ] Where interest-capture events are stored (new small table vs. `logOperation`).
- [ ] Whether the 48–72h post-boost "receipt" notification (views uplift) ships with
      v1 or after — it's the repeat-usage engine but needs uplift stats plumbing.

## Risks / unknowns
- Composite boost feels weak on a quiet board (early liquidity) → gate any stats-brag
  notification on a real uplift threshold; send goodwill (extension) instead of noise.
- "Re-pinned" badge stigma → keep it metaphor-native and tiny; never ad-speak.
- Weekly cap frustrates power sellers pre-payments → that frustration is the demand
  signal being measured; don't soften it with admin overrides.

## Out of scope
- Payment gateway, pricing UI, refunds (deferred until demand trigger fires).
- Boosting individual member ads in any form (permanently rejected, not deferred).
- Fractional/per-member pin weighting.

## How we'd validate it
Cap-hit interest-tap rate per region per week. Sustained >20% of active boosters
capped + majority "I'd use extra pins" taps ⇒ build payments for that region.

## Related
- `.agent/plans/boost-to-top-feature.md` — base Boost mechanics (cooldown, bumpedAt,
  admin settings); this doc layers the weekly pin tier + composite rules on top.
- `ResearchLab/ideas/bundle-listing-design.md`, `moving-sale-mode-design.md`
- `ResearchLab/market-readiness-2026-07.md` — trust-first positioning that drove the
  no-cascade decision.
- Unified-feed architecture brainstorm (in progress, 2026-07-16) — depends on every
  card type carrying its own `bumpedAt`.

## Log
- 2026-07-16 — Rules decided: card-only boost, permanent member ineligibility, 3
  pins/week (ad=1, composite=2), paid-bypass model deferred behind demand trigger,
  cap-hit interest capture. Analyst + designer agent reports reconciled with the
  existing boost plan; 2-pin weighting accepted by Amir.
