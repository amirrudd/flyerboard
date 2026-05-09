# ResearchLab

A space to capture, iterate on, and eventually ship ideas for FlyerBoard.

## Structure

```
ResearchLab/
├── README.md           # This file — index of all ideas
├── STRATEGY.md         # Positioning, niche, cold-start, monetization
├── _template.md        # Copy this when starting a new idea
└── ideas/
    └── <idea-slug>.md  # One file per idea
```

## How to use

1. Copy `_template.md` into `ideas/` and rename it to a short slug (e.g. `ideas/saved-search-alerts.md`).
2. Fill in the sections — keep it rough, this is a sketchpad.
3. Add a row to the **Index** below.
4. Iterate. When an idea is ready to build, move its status to `Ready` and link out to a real plan / PR.

## Status legend

- `Seed` — half-formed, just a thought.
- `Exploring` — actively poking at it, gathering notes.
- `Ready` — defined enough to start building.
- `Shipped` — done, kept here as a record.
- `Parked` — interesting but not now (note why).

## Feasibility scoring

Every idea is rated on three axes (1–5) and given an **Overall** call:

- **Build** — how hard to ship a credible v1 (1=trivial, 5=hard).
- **Value@0** — how useful with *zero* FlyerBoard buyers (1=needs liquidity, 5=valuable alone).
- **Diff** — differentiation vs Marketplace / Gumtree (1=anyone could build, 5=uniquely ours).
- **Overall** — gut call combining the three, biased toward shipping things that work without liquidity first.

## Index

| Idea | Status | Build | Value@0 | Diff | Overall | Notes |
|------|--------|-------|---------|------|---------|-------|
| [Moving sale mode](ideas/moving-sale-mode.md) | Exploring | 4 | 5 | 5 | **5** | Now the *clearest* wedge — Meta's March 2026 AI launch didn't touch multi-item bundles. AU TAM ≈ 1.14M moves/yr. |
| [Printable flyers](ideas/printable-flyers.md) | Exploring | 3 | 5 | 5 | **5** | Build bumped 2→3 (Cloudflare Browser Run for HTML→PDF). The only physical surface Meta can't replicate. |
| [Wanted ads](ideas/wanted-ads.md) | Exploring | 3 | 4 | 4 | **4** | Demand side is unclaimed after Meta's supply-side launch. Watch for scam-honeypot and privacy. |
| [Cross-posting pack](ideas/cross-posting-pack.md) | Exploring | 3 | 3 | 2 | **3** | Funnel-back blocked by Gumtree ToS. Survives as casual-AU-seller tool. |
| [Buyer-message copilot](ideas/buyer-message-copilot.md) | Exploring | 3 | 3 | 3 | **3** | Auto-replies now commodity (Meta shipped 2026-03-12). Scam-shield is the surviving wedge. |
| [AI photo-to-listing](ideas/ai-photo-to-listing.md) | Exploring | 4 | 4 | 1 | **2** | Meta shipped this in-app on 2026-03-12 with tone variants. No longer the front door — only useful as a moving-sale component. |
| [Deal finder (buyer)](ideas/deal-finder.md) | Parked | 3 | 2 | 3 | **2** | Defer until listing supply exists. Native FB alerts are broken; multi-platform monitors already exist. |
| [Price estimation](ideas/price-estimation.md) | Exploring | 4 | 3 | 1 | **1** | Meta now does this with local comps; we have neither data nor distribution. Reframe as table-stakes inside photo-to-listing. |

## Quick read on what to build first

Build order optimised for "valuable with zero buyers":

1. **AI photo-to-listing** — the wedge.
2. **Printable flyers** — small build, big narrative win, on-brand.
3. **Cross-posting pack** — converts FlyerBoard from marketplace to seller tool.
4. **Moving sale mode** — wraps 1–3 into a paid SKU (the A$9 Moving Sale Pack).
5. *Then* the rest, once we have listings flowing.

See `STRATEGY.md` for the full thesis, niche pick, and 30-day plan.
