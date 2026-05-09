# AI photo-to-listing ("Sell it for me")

- **Status:** Exploring
- **Created:** 2026-05-09
- **Last touched:** 2026-05-09

## Feasibility
- **Build effort:** 4/5 (vision LLM + structured output + existing R2 upload — unchanged)
- **Standalone value:** 4/5 (was 5/5 — still useful for sellers who don't already use Marketplace, but the unique-buyer-side-win evaporated when Meta shipped this in-app)
- **Differentiation:** 1/5 (was 3/5 — Meta launched AI photo-to-listing on FB Marketplace in March 2026 with the same workflow, plus tone variants we hadn't even built. Independent hands-on review by Value Added Resource: identified items correctly, reasonable pricing, "performed better than many of the various AI listing tools competing marketplaces have launched")
- **Overall:** 2/5 (was 4/5 — no longer the front door. Defensible only as part of a moving-sale or cross-platform workflow, not as a standalone wedge.)

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
- Vision-capable LLMs are cheap enough to run per-listing — typical phone photo costs ~A$0.01–0.02 per pass on Claude / GPT / Gemini in 2026.
- ~~Meta is moving in this direction on Marketplace; gap closes if we don't move.~~ **The gap closed.** Meta shipped the feature on 2026-03-12. The "ship before they do" window is gone.
- We already have the R2 upload + ad-create plumbing — this is a layer on top, not a rewrite.
- New angle: defensible only if it does something Meta's in-app version *can't* — bulk/moving-sale flow, output for cross-platform, AU-specific category and pickup norms, or workflow continuity with our other tools.

## Open questions
- [x] Which vision model balances cost vs accuracy for messy phone photos? — Cheap enough across the board (~A$0.01–0.02/image); pick on accuracy not cost. Run a head-to-head on real seller photos.
- [ ] How many clarifying questions before sellers bail? (Probably ≤3.)
- [ ] Do we cache image analysis to keep cost predictable?
- [ ] **New:** What does this do that Meta's in-app version doesn't? Without an answer, this is the *same* feature on a marketplace with no buyers — i.e., worse.
- [ ] **New:** AU Privacy Act APP 1.7–1.9 takes effect 2026-12-10 (disclosure when AI uses personal info to make decisions). Photo → LLM → listing fields counts. Privacy policy update needed before launch.
- [ ] **New:** Under APP 8, we stay legally responsible for personal info sent to overseas LLM providers. Vendor selection (US-hosted vs AU-hosted endpoints) becomes a compliance question, not just a cost one.

## Risks
- **Meta parity.** They have the same feature in-app, with their full liquidity. Our only defensible reason for a seller to use ours is: better quality, AU-tuned, or slots into a workflow Meta doesn't offer (moving sale, multi-platform).
- Hallucinated specs (wrong brand/model) → buyer disputes. Meta has the same risk; not a differentiator.
- Cost per listing if traffic spikes. Mitigation: rate-limit + cache.
- **AU Privacy Act compliance.** APP 6 + APP 8 + new APP 1.7–1.9 all bite. Disclosure needed; vendor data-residency decision needed.

## How we'd validate
~~Ship behind a flag to a handful of testers. Metric: time-to-publish vs the current manual flow, and % of generated fields the seller keeps unedited.~~

Updated framing: don't validate this as a standalone wedge — Meta just won that race. Validate it *only* as a component of moving-sale-mode or as part of a cross-platform pack (where the output goes to FlyerBoard + Gumtree + IG, not just FB). Useful metric: does a seller who used our generator publish on >1 platform? If they only publish to FB, they should've used Meta's instead.

## Log
- 2026-05-09 — first sketch.
- 2026-05-09 — feasibility pass: Meta launched the same feature on FB Marketplace 2026-03-12 (photo → title/description/price + tone variants). Hands-on review showed strong quality. Vision LLM cost ~A$0.01–0.02/image is fine. AU Privacy Act APP 1.7–1.9 from 2026-12-10 + APP 8 (overseas processors) are now in scope. Scores Standalone value 5→4, Diff 3→1, Overall 4→2. No longer the front door. Defensible only as a component of moving-sale-mode or as the engine for the cross-posting pack.
