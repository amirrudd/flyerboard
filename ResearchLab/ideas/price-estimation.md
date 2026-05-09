# Price estimation agent

- **Status:** Seed
- **Created:** 2026-05-09
- **Last touched:** 2026-05-09

## Feasibility
- **Build effort:** 4/5 (the *easy* version is a vibe-check; the *good* version needs comp data)
- **Standalone value:** 4/5 (sellers ask this question first, every time)
- **Differentiation:** 2/5 (everyone wants this; nobody does it well)
- **Overall:** 2/5 — high-value but the data problem is the whole problem. Probably ship a hedged v0 and learn.

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
3. **Comp data from listings** — accurate but means scraping (ToS risk) or building our own listing volume first (chicken-and-egg).

## Why now
This is the seller's first question. Even an "approximate but with reasoning" answer is differentiated vs Marketplace's null.

## Open questions
- [ ] Can we ship v0 as "AI estimate, take with a grain of salt" without losing trust?
- [ ] Is there an Australian price-comp data source (eBay sold listings? Gumtree?) we can use legally?
- [ ] Do we surface uncertainty as a range or as a confidence score?

## Risks
- Bad estimates make us look stupid → trust hit on the most-visible feature.
- Scraping competitors is brittle and legally risky.
- Sellers anchor on our suggestion and blame us when it's wrong.

## How we'd validate
Ship v0 LLM-only, ask sellers post-sale "did the suggestion match what you actually got?" Compare to actual sale price. If error band is too wide, invest in comp data.
