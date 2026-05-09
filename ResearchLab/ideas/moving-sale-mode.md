# Moving sale mode (multi-item decluttering flow)

- **Status:** Seed
- **Created:** 2026-05-09
- **Last touched:** 2026-05-09

## Feasibility
- **Build effort:** 4/5 (reuses photo-to-listing × N + a public sale page; bundling logic is new)
- **Standalone value:** 5/5 (high urgency, multi-item, value before any FlyerBoard buyers exist)
- **Differentiation:** 5/5 (Marketplace has no concept of a multi-item sale)
- **Overall:** 5/5 — strongest concrete wedge. This is the niche to start with.

## Problem
People moving house have 10–30 items to sell in 1–2 weeks. Listing each one separately on Marketplace is exhausting. Pricing 20 things is exhausting. Replying to "is this still available?" 20× per item is exhausting. They give up and donate or skip.

## Sketch
"Run a moving sale" mode:
1. Bulk upload — photos of multiple items, one at a time or as a roll.
2. Agent detects items, splits into individual listings, asks one batch of clarifying questions across all of them.
3. Suggests **bundles** ("desk + chair + monitor — $X as a package") and what to **donate vs sell**.
4. Generates a single **public sale page**: "Amir's Moving Sale — Richmond — Saturday only", lists all items, bundle prices, pickup window.
5. Auto-generates the cross-posting pack for the *whole sale* (one Facebook post linking to the sale page, not 20 individual posts).
6. Optional: printable A4 flyer with a QR code (see `printable-flyers.md`).

## Why now
- Concrete, urgent use case. Easy to explain.
- Stacks on top of `ai-photo-to-listing.md` + `cross-posting-pack.md` + `printable-flyers.md` — those features become components.
- Natural paywall: "$9 Moving Sale Pack" is easier to sell than "pay to list."

## Open questions
- [ ] How do we model "this is part of a sale event" in the schema? (New `saleEvents` table that ads belong to?)
- [ ] What's the cap on items per sale (cost / abuse)?
- [ ] Does the public sale page live at a permanent slug, or does it expire?

## Risks
- Cost spike if a single user uploads 50 items — needs per-sale rate limit.
- Public page that's shared but then half the items sell → looks dead. Need clean "sold" UX.

## How we'd validate
Recruit 5 actual movers from local Facebook groups. Run their sale end-to-end. Compare: items sold, time spent, revenue, vs their previous Marketplace experience.
