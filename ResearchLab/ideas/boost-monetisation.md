# Boost — weekly free allowance, composite-card boosting & paid-demand capture

- **Status:** Decided (rules locked; **unified-feed prerequisite SHIPPED 2026-07-19** — allowance/payment layer not yet built)
- **Created:** 2026-07-16
- **Last touched:** 2026-08-15
- **Owner:** Amir

## Problem
Boost ("bump back to the top") is the primary monetisation lever, but v1 ships free with no
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

### Free tier — weekly boost allowance (replaces the 3/day cap as the primary limiter)
- **3 boosts per user per week** (admin-configurable). Standard ad = 1 boost;
  Bundle/Sale card = **2 boosts** ("bigger flyer, two boosts" — weighting accepted by
  Amir 2026-07-16). Integer weights only; no fractional/per-member weighting.
- 7-day per-item cooldown unchanged (admin-configurable 1–30 days).
- Static 20/day abuse backstop stays, even after payments exist.
- Why weekly not daily: 3/day = 21/week is not scarcity — one seller can keep sending
  the same flyer up all week free. 3/week makes free boosts an allowance, not a
  utility; the 2-boost composite weight pre-anchors the future 1.5× paid premium.

### Paid phase (deferred — no payment gateway yet)
- Model when it ships: free weekly boosts stay; **paid boosts bypass the weekly cap
  only** (cooldown always applies). Ad ≈ A$4–6 one-off impulse price; composite card
  = 1.5×. No free member-boost bundling, no paid member add-on (dropped — members are
  ineligible, full stop).
- **Trigger to build payments: measured demand, not a date.** Flip a region when
  cap-hit interest is sustained (analyst heuristic: >20% of active boosters hitting
  the weekly cap two weeks running).
- `boostCount` is recorded per card from day one (already in the boost plan) so any
  "first N free" variant needs no migration.

### Demand capture at cap-hit (v1, pre-payments)
When a user with 0 boosts left taps Boost: same bottom-sheet slot, neutral (not red,
not blocking), copy per designer spec:

> **You've used your 3 boosts this week** — they come back Monday.
> Some sellers want extra boosts before then. We're deciding whether to build it.
> [ **I'd use extra boosts** ] [ Not for me ]
> *One tap. No payment, no commitment — just a show of hands.*

- Log BOTH taps (interest + not-for-me) with listing type + weekday — this dataset
  decides when to build the payment gateway.
- After tap: button morphs in place to "✓ Noted — you're on the list. If we build
  extra boosts, you'll hear about it first." No new screen, no overpromise.

### UX spec (designer, accepted direction)

> **Wording correction, 2026-08-15.** Boost is a **refresh, not a pin**: it re-stamps
> `bumpedAt` to now, so the ad goes to the top and then sinks again as newer ads arrive.
> Ten new posts and it is ten places down. The copy below originally said "re-pin",
> which promises the ad will *stay* up — a promise the mechanic does not keep, and now a
> stated violation of rule 3 in `.agent/PRODUCT-RULES.md` ("user-facing copy that
> promises an ad will *stay* at the top"). Left unfixed it produces the worst kind of
> support ticket: *"I paid to pin my ad and it moved down within the hour"* — an
> accurate complaint about a product working correctly.
>
> **Pin language is gone entirely** — both as the verb and as the name of the allowance.
> The first pass kept "pins" for the allowance on the grounds that it names a currency,
> not an outcome; Amir then reversed that the same day. The metaphor's whole justifi-
> cation was that it teaches itself, and what it teaches is *sticking*. It is "boosts"
> now: one word for the action and the allowance, and it teaches the right model.

- **Vocabulary: "boosts", never "pins", "slots" or "credits".** One word for the action
  and for the allowance — you spend a boost to boost a flyer. "3 boosts a week" needs no
  tutorial and, unlike the pin metaphor it replaces, it teaches the right model: nothing
  sticks, the flyer goes up and drifts back down. No pin language anywhere.
- Allowance state = three Phosphor `ArrowFatUp` icons (filled = available, outline =
  used), shown top-right of the boost confirm sheet — the only moment it matters. On
  confirm the spent boosts animate filled → outline; the animation IS the ledger.
- Confirm-sheet microcopy: ad → "Send it back to the top … Uses 1 of your 3 weekly
  boosts"; bundle → "Send the whole bundle back to the top — all N items as one flyer.
  Bigger flyer, two boosts. … Uses 2 boosts — 1 left this week."
- Member-ad Boost button is NOT disabled (dead buttons feel broken) — it opens a slim
  sheet: "This flyer's part of your '{bundle label}' bundle. Bundles go back up
  together — all N items on one flyer. [Send the bundle up →] [Cancel]". The rejection
  IS the upsell.
- Dashboard: one inline `⬆⬆○` indicator in the header, tooltip "2 boosts left ·
  renews Monday". No per-listing badges, history lists, or countdowns at v1.
- Boosted cards in the feed get a small "Just bumped" micro-badge (never "Sponsored")
  for the boost window; no glow, no other buyer-side change. Not a pushpin icon and not
  "Re-pinned" — the card is not pinned, it simply became new again, and it will drift
  down like anything else.

## Open questions
- [x] ~~Is "pins" still the right name for the allowance?~~ **Decided 2026-08-15: no —
      it's "boosts".** The pin metaphor's whole selling point was that it teaches
      itself, but what it teaches is *sticking*, which is the opposite of what a boost
      does. One word now covers the action and the allowance. Revisit only if a better
      word appears; the cost of changing rises steeply once payments ship.
- [ ] Exact weekly reset semantics: rolling 7-day window vs. calendar Monday reset
      (designer copy assumes Monday; rolling is fairer but unexplainable — lean Monday).
- [ ] Where interest-capture events are stored (new small table vs. `logOperation`).
- [ ] Whether the 48–72h post-boost "receipt" notification (views uplift) ships with
      v1 or after — it's the repeat-usage engine but needs uplift stats plumbing.

## Risks / unknowns
- Composite boost feels weak on a quiet board (early liquidity) → gate any stats-brag
  notification on a real uplift threshold; send goodwill (extension) instead of noise.
- "Just bumped" badge stigma → keep it plain and tiny; never ad-speak.
- Weekly cap frustrates power sellers pre-payments → that frustration is the demand
  signal being measured; don't soften it with admin overrides.

## Out of scope
- Payment gateway, pricing UI, refunds (deferred until demand trigger fires).
- Boosting individual member ads in any form (permanently rejected, not deferred).
- Fractional/per-member boost weighting.

## How we'd validate it
Cap-hit interest-tap rate per region per week, against the paid-phase trigger
defined above (see "Paid phase") plus majority "I'd use extra boosts" taps.

## Related
- `.agent/plans/boost-to-top-feature.md` — base Boost mechanics (cooldown, bumpedAt,
  admin settings); this doc layers the weekly boost allowance + composite rules on top.
- `ResearchLab/ideas/bundle-listing-design.md`, `moving-sale-mode-design.md`
- `ResearchLab/market-readiness-2026-07.md` — trust-first positioning that drove the
  no-cascade decision.
- Unified feed — **SHIPPED 2026-07-19** (PRs #325/#327): every card type now carries
  its own `bumpedAt` and the feed is one `mergedStream` query, so the card-only
  boost semantics this doc assumes are now buildable. Spec:
  `docs/superpowers/specs/2026-07-16-unified-feed-pagination-design.md`; rationale:
  `docs/architecture/design-decisions.md` ("Unified feed via mergedStream").
- Admin-configurable boost knobs — **SHIPPED 2026-07-19** (PR #326): `boostCooldownDays`
  and `boostDailyCap` are live in the admin Settings tab (`convex/lib/appConfig.ts`);
  the weekly boost allowance + composite 2-boost weight this doc specifies would extend
  that same registry.

## Log
- 2026-07-19 — Unified-feed prerequisite shipped to prod (#325/#327); admin boost
  config shipped (#326). Pins/weekly-cap/interest-capture layer still unbuilt but
  now unblocked. Status/Related updated.
- 2026-07-16 — Rules decided: card-only boost, permanent member ineligibility, 3
  pins/week (ad=1, composite=2), paid-bypass model deferred behind demand trigger,
  cap-hit interest capture. Analyst + designer agent reports reconciled with the
  existing boost plan; 2-pin weighting accepted by Amir.
