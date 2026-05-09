# Price estimation agent

- **Status:** Exploring
- **Created:** 2026-05-09
- **Last touched:** 2026-05-09

## Feasibility
- **Build effort:** 4/5 (LLM-only v0 is easy; comp-data version is a data problem with no clean legal path)
- **Standalone value:** 3/5 (was 4/5 — still the seller's first question, but Meta now answers it in-app for the same audience)
- **Differentiation:** 1/5 (was 2/5 — Meta launched local-comp-based AI pricing on FB Marketplace 2026-03-12. We have neither their data nor their distribution.)
- **Overall:** 1/5 (was 2/5 — even the hedged v0 is now copy-of-Meta on a smaller marketplace. Re-frame as a feature *of* photo-to-listing, not a standalone agent.)

## Problem
Sellers either over-price (no sale) or under-price (regret). Buyers can't tell if a listing is fair. "What should I list this for?" is the #1 question.

## Sketch
Output format:
```
Recommended list price: A$180
Likely sale price: A$130–A$160
Fast-sale price: A$100
Reason: similar used IKEA 3-seat couches nearby list around A$150–A$220, yours has visible wear.
```

Three honest ways to get there, in increasing accuracy:
1. **LLM general-knowledge guess** — fast, free-ish, wrong sometimes. Label clearly as "estimate."
2. **Manual category benchmarks** — we curate price bands per category for AU. Boring but honest.
3. ~~**Comp data from listings** — accurate but means scraping (ToS risk) or building our own listing volume first (chicken-and-egg).~~ **Now confirmed unworkable**, see Risks: Gumtree explicitly prohibits scraping in ToS *and* has copyright protection on the compilation; eBay's `Marketplace Insights API` is Limited Release (90-day window only), and Q1 2026 saw a wave of third-party comp aggregators collapse after eBay revoked public keys.

## Why now
This is the seller's first question. ~~Even an "approximate but with reasoning" answer is differentiated vs Marketplace's null.~~ **Marketplace's null is gone** — Meta's pricing suggestion uses local comps (the data we don't have). Reframe: this is a *table-stakes* feature for any seller flow we ship, not a wedge.

## Open questions
- [x] Can we ship v0 as "AI estimate, take with a grain of salt" without losing trust? — Yes, but it's now table-stakes, not a differentiator.
- [x] Is there an Australian price-comp data source (eBay sold listings? Gumtree?) we can use legally? — **No clean path.** eBay Marketplace Insights API: Limited Release, 90 days, AU-region availability unclear. Gumtree: scraping is a ToS violation + copyright infringement. Building our own comps requires listing volume we don't have.
- [x] Do we surface uncertainty as a range or as a confidence score? — Range. Confidence scores invite false precision and amplify the anchoring liability.
- [ ] **New:** Where can we ship a *better* answer than Meta? Probably: rare/niche categories where their local-comp pool is empty (collectibles, hobby gear, regional specialties). Worth testing.

## Risks
- **Meta has the data; we don't.** Their pricing is based on what similar items are *currently listed* for in the seller's local area — that's their feed. Our LLM-only version is structurally weaker.
- **Scraping is closed off.** Gumtree ToS: "any robot spider, scraper or other automated means … without express written permission" prohibited; content protected by copyright as a compilation. eBay revoked public API keys in 2025; Marketplace Insights is limited-release and 90-day.
- Bad estimates make us look stupid → trust hit on the most-visible feature. Risk is *higher* now because Meta's number is sitting next to ours; ours being further from sale price is more obvious.
- Sellers anchor on our suggestion and blame us when it's wrong. Mitigation: range + "estimate" label + post-sale calibration loop.

## How we'd validate
Don't validate as standalone. Bake it into the photo-to-listing flow with a clear "estimate" label and a range, then track post-sale: how often did the actual sale price fall inside our suggested range? If it's <60%, the feature is hurting trust more than it helps and should be hidden behind a "guess for me" button.

## Log
- 2026-05-09 — first sketch.
- 2026-05-09 — feasibility pass: Meta shipped local-comp pricing on FB Marketplace 2026-03-12; we have neither their data nor their distribution. eBay Marketplace Insights API confirmed limited-release / 90-day; Gumtree scraping confirmed ToS-prohibited and copyright-protected. Scores Standalone value 4→3, Diff 2→1, Overall 2→1. Reframed as table-stakes feature inside photo-to-listing rather than a wedge.
