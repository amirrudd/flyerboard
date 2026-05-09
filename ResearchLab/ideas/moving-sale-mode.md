# Moving sale mode (multi-item decluttering flow)

- **Status:** Exploring
- **Created:** 2026-05-09
- **Last touched:** 2026-05-09

## Feasibility
- **Build effort:** 4/5 (reuses photo-to-listing × N + a public sale page; bundling logic is new — unchanged)
- **Standalone value:** 5/5 (high urgency, multi-item, value before any FlyerBoard buyers exist — unchanged)
- **Differentiation:** 5/5 (Meta's March 2026 AI launch is per-listing only — they have no concept of a multi-item bundled sale; no AU competitor in the personal-moving-sale space)
- **Overall:** 5/5 — now the *clearest* wedge after Meta's March 2026 launch eroded the supply-side ideas. This is the niche.

## Problem
People moving house have 10–30 items to sell in 1–2 weeks. Listing each one separately on Marketplace is exhausting. Pricing 20 things is exhausting. Replying to "is this still available?" 20× per item is exhausting. They give up and donate or skip.

**Market size**: ~1.14 million Australian households move each year (ABS, 2019–20 financial year — 12% of all households). Two-thirds of moves cluster Oct–Mar. The Australian removalist industry is ~A$2B/year; average household spends ~A$3K per move. Even at 1% reach × 5% conversion to a A$9 Moving Sale Pack, that's a real number.

## Sketch
"Run a moving sale" mode:
1. Bulk upload — photos of multiple items, one at a time or as a roll.
2. Agent detects items, splits into individual listings, asks one batch of clarifying questions across all of them.
3. Suggests **bundles** ("desk + chair + monitor — $X as a package") and what to **donate vs sell**.
4. Generates a single **public sale page**: "Amir's Moving Sale — Richmond — Saturday only", lists all items, bundle prices, pickup window.
5. Auto-generates the cross-posting pack for the *whole sale* (one Facebook post linking to the sale page, not 20 individual posts) — note: the back-link only works on FB / IG, not Gumtree (see `cross-posting-pack.md`).
6. Optional: printable A4 flyer with a QR code (see `printable-flyers.md`).

## Why now
- Concrete, urgent use case. Easy to explain.
- Stacks on top of `ai-photo-to-listing.md` + `cross-posting-pack.md` + `printable-flyers.md` — those features become components, and crucially this is the *only* surface where photo-to-listing has a reason to exist post-Meta-launch (the bulk/multi-item workflow Meta doesn't offer).
- Natural paywall: "$9 Moving Sale Pack" is easier to sell than "pay to list."
- **New:** No US-style competitor exists in AU. EverythingButTheHouse and MaxSold are US estate-sale platforms targeting downsizing/deceased estates, not personal moves. The personal-moving-sale niche in AU is unclaimed.
- **New:** Removalist partnerships are a real B2B distribution channel — A$2B industry, customer is captive in the 4–6 weeks before a move, and removalists already get asked "what should I do with all this stuff?" Co-promotion is plausible.

## Open questions
- [ ] How do we model "this is part of a sale event" in the schema? (New `saleEvents` table that ads belong to?)
- [ ] What's the cap on items per sale (cost / abuse)?
- [ ] Does the public sale page live at a permanent slug, or does it expire?
- [ ] **New:** Removalist partnership go-to-market — is it B2B sales (one-by-one) or affiliate (give removalists a referral link)? STRATEGY.md flags this as an open question; worth a real test with one local removalist.
- [ ] **New:** With Gumtree back-links forbidden, the cross-posting pack for a moving sale on Gumtree has to exist as standalone copy *without* a back-link. Does the sale page work without inbound traffic from Gumtree, or do we need to over-index on FB/IG/print/word-of-mouth?

## Risks
- Cost spike if a single user uploads 50 items — needs per-sale rate limit.
- Public page that's shared but then half the items sell → looks dead. Need clean "sold" UX.
- **New:** Stacking dependency. Moving-sale-mode is the wrapper, but it requires photo-to-listing to actually be reliable, the cross-posting pack to be useful (without Gumtree back-link), and printable flyers to ship. If any of those underperforms, the wrapper underperforms. De-risk by shipping each component standalone first.
- **New:** Seasonality risk. Two-thirds of moves are Oct–Mar; launching off-season delays signal. Plan launch for ~September to catch the spring move wave.

## How we'd validate
Recruit 5 actual movers from local Facebook groups. Run their sale end-to-end. Compare: items sold, time spent, revenue, vs their previous Marketplace experience. Ideally do this Sept–Nov 2026 to catch the seasonal peak.

## Log
- 2026-05-09 — first sketch.
- 2026-05-09 — feasibility pass: market size confirmed (~1.14M AU moves/year, ~A$2B removalist industry); no AU competitor in personal-moving-sale space (US estate-sale platforms target a different segment); Meta's March 2026 AI launch did not touch multi-item bundling, *strengthening* this wedge by elimination. Added removalist B2B partnership angle, seasonality (Sept launch), and stacking dependency on the components. Scores unchanged at 5/5 but now the clearest wedge.
