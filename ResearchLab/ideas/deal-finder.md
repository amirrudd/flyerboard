# Deal-finder agent (buyer-side saved search)

- **Status:** Parked
- **Created:** 2026-05-09
- **Last touched:** 2026-05-09

## Feasibility
- **Build effort:** 3/5 (saved search + alerts is easy; "is this a good deal?" is the harder layer — unchanged)
- **Standalone value:** 2/5 (needs listing volume to be useful — pure liquidity play — unchanged)
- **Differentiation:** 3/5 (FB Marketplace's "Notify me" button is widely reported as broken in 2026; Gumtree's saved-search emails work; multi-platform monitoring tools — Swoopa, Marketplace Monitor, CarSnipe — already exist. There's room for a *better* version, but only if it monitors all platforms, which is a different product.)
- **Overall:** 2/5 — defer until we have supply. Building this on an empty marketplace teaches us nothing. **Status moved Seed → Parked** to reflect the build-order decision in `STRATEGY.md`.

## Problem
Buyers don't refresh. They give up after one search and go elsewhere. Repeat usage requires a reason to come back.

## Sketch
Buyer expresses intent in plain English:
> "Find me a standing desk under $200 near Richmond, not damaged, can fit in a hatchback."

Agent:
1. Parses to structured filters (category, price, suburb radius, condition, size constraints).
2. Saves as a watchlist.
3. Pings via push/email when a matching listing appears.
4. Adds a "is this a good deal?" button on each listing — uses price estimation + comps.

## Why now
- We already have `savedAds`. Extending to saved *searches* is a small step.
- Push notifications are already wired up.
- **But not yet.** This idea needs supply to deliver value. Deferred to post-supply (>50 listings/day in a target suburb), per `STRATEGY.md` "what we're explicitly *not* doing."

## Open questions
- [ ] How many alerts before they become noise? (Cap per day? Confidence threshold?)
- [ ] Does the parsed intent need user confirmation before saving, or do we just show editable filters?
- [ ] Reuse the price-estimation agent for "good deal?" verdict, or simpler heuristic?
- [ ] **New:** If we ever pivot this into a multi-platform deal-finder (FB + Gumtree + FlyerBoard), the existing players (Swoopa, Marketplace Monitor) already do this and have a head start. Worth doing *only* if FlyerBoard becomes one of the listings sources, not as a third-party monitor.

## Risks
- **Liquidity-dependent**: zero new listings = zero alerts = uninstalls.
- Over-aggressive notifications kill the channel.
- **New:** Crowded space if positioned as multi-platform. Existing tools already cover FB / Gumtree / OfferUp / Craigslist / Kijiji.

## How we'd validate
Don't build standalone. Build *after* we have a steady stream of listings (>50/day in a target suburb). Until then, it's a feature looking for a marketplace.

## Log
- 2026-05-09 — first sketch.
- 2026-05-09 — feasibility pass: confirmed FB native saved-search alerts are widely reported as broken in 2026; Gumtree's work via email; multi-platform third parties (Swoopa, Marketplace Monitor, CarSnipe) already exist. No change to the defer-until-supply call. Status moved Seed → Parked to make the deferral explicit in the index.
