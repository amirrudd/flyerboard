# AI photo-to-listing ("Sell it for me")

- **Status:** Seed
- **Created:** 2026-05-09
- **Last touched:** 2026-05-09

## Feasibility
- **Build effort:** 4/5 (straightforward — vision LLM + structured output + existing R2 upload)
- **Standalone value:** 5/5 (works with zero buyers; pure seller-side win)
- **Differentiation:** 3/5 (Meta is shipping similar; sharper workflow is the wedge)
- **Overall:** 4/5 — strong wedge, this is the front door of the whole product.

## Problem
Private sellers write bad listings: missing dimensions, no pickup suburb, vague titles, wrong category, junk price. Result: repetitive buyer questions, slow sales, low-ball offers.

## Sketch
Seller uploads 3–6 photos and types one sentence ("selling my couch").
Agent does:
1. Detects item from photos (vision model).
2. Asks 2–4 clarifying questions only for what it can't infer (dimensions, condition, pickup suburb).
3. Generates: title, description, category, condition, price range, pickup details.
4. Lets seller edit inline, then publishes to FlyerBoard.

## Why now
- Vision-capable LLMs are cheap enough to run per-listing.
- Meta is moving in this direction on Marketplace; gap closes if we don't move.
- We already have the R2 upload + ad-create plumbing — this is a layer on top, not a rewrite.

## Open questions
- [ ] Which vision model balances cost vs accuracy for messy phone photos?
- [ ] How many clarifying questions before sellers bail? (Probably ≤3.)
- [ ] Do we cache image analysis to keep cost predictable?

## Risks
- Hallucinated specs (wrong brand/model) → buyer disputes. Mitigation: always show "AI suggested, please confirm" before publish.
- Cost per listing if traffic spikes. Mitigation: rate-limit + cache.

## How we'd validate
Ship behind a flag to a handful of testers. Metric: time-to-publish vs the current manual flow, and % of generated fields the seller keeps unedited.
