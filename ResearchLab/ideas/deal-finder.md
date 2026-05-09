# Deal-finder agent (buyer-side saved search)

- **Status:** Seed
- **Created:** 2026-05-09
- **Last touched:** 2026-05-09

## Feasibility
- **Build effort:** 3/5 (saved search + alerts is easy; "is this a good deal?" is the harder layer)
- **Standalone value:** 2/5 (needs listing volume to be useful — pure liquidity play)
- **Differentiation:** 3/5
- **Overall:** 2/5 — defer until we have supply. Building this on an empty marketplace teaches us nothing.

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

## Open questions
- [ ] How many alerts before they become noise? (Cap per day? Confidence threshold?)
- [ ] Does the parsed intent need user confirmation before saving, or do we just show editable filters?
- [ ] Reuse the price-estimation agent for "good deal?" verdict, or simpler heuristic?

## Risks
- **Liquidity-dependent**: zero new listings = zero alerts = uninstalls.
- Over-aggressive notifications kill the channel.

## How we'd validate
Don't build standalone. Build *after* we have a steady stream of listings (>50/day in a target suburb). Until then, it's a feature looking for a marketplace.
