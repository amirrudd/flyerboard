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
| [Moving sale mode](ideas/moving-sale-mode.md) | Seed | 4 | 5 | 5 | **5** | Strongest concrete wedge. Pick this as the niche. |
| [Printable flyers](ideas/printable-flyers.md) | Seed | 2 | 5 | 5 | **5** | Cheap, on-brand, the only literal "FlyerBoard" feature. |
| [AI photo-to-listing](ideas/ai-photo-to-listing.md) | Seed | 4 | 5 | 3 | **4** | The front door. Vision LLM + structured output. |
| [Cross-posting pack](ideas/cross-posting-pack.md) | Seed | 3 | 5 | 4 | **4** | Counterintuitive but solves cold-start. No auto-post. |
| [Wanted ads](ideas/wanted-ads.md) | Seed | 3 | 4 | 4 | **4** | Sleeper pick — attacks cold-start from demand side. |
| [Buyer-message copilot](ideas/buyer-message-copilot.md) | Seed | 3 | 3 | 4 | **3** | Bolt-on once volume exists. Scam shield is the unlock. |
| [Price estimation](ideas/price-estimation.md) | Seed | 4 | 4 | 2 | **2** | High-value but data problem is the whole problem. Ship hedged v0 only. |
| [Deal finder (buyer)](ideas/deal-finder.md) | Seed | 3 | 2 | 3 | **2** | Defer until listing supply exists. |

## Quick read on what to build first

Build order optimised for "valuable with zero buyers":

1. **AI photo-to-listing** — the wedge.
2. **Printable flyers** — small build, big narrative win, on-brand.
3. **Cross-posting pack** — converts FlyerBoard from marketplace to seller tool.
4. **Moving sale mode** — wraps 1–3 into a paid SKU (the A$9 Moving Sale Pack).
5. *Then* the rest, once we have listings flowing.

See `STRATEGY.md` for the full thesis, niche pick, and 30-day plan.
