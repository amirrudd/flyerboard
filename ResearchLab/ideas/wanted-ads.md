# Wanted ads (reverse listings — buyers post intent)

- **Status:** Seed
- **Created:** 2026-05-09
- **Last touched:** 2026-05-09

## Feasibility
- **Build effort:** 3/5 (new table + a matching job; UI is mostly the same as listings)
- **Standalone value:** 4/5 (demand-first: works even when supply is thin, and signals what to seed)
- **Differentiation:** 4/5 (Marketplace doesn't structure demand at all)
- **Overall:** 4/5 — sleeper pick. Could attack cold-start from the buyer side.

## Problem
Classic two-sided cold-start: sellers won't list without buyers; buyers won't show up without listings. Posting *demand* breaks the deadlock — a wanted ad is useful even with zero matching supply because it *creates* a reason for a seller to list.

## Sketch
Buyer:
> "I'm looking for a used washing machine under $300 within 10km of Brunswick."

Agent:
1. Turns it into a structured wanted ad (category, price ceiling, location, must-haves).
2. Publishes to a `/wanted` board.
3. When a matching listing appears, alerts both parties.
4. Crucially: when no listing exists, *we know what to recruit*. A wanted ad is a demand signal we can use to seed supply ("hey, someone in your suburb wants this — list yours").

## Why now
- Tackles cold-start directly, which other ideas don't.
- Cheap to build on top of the existing `ads` schema (an `ads` row with a `kind: "wanted"` flag, or a separate `wantedAds` table).

## Open questions
- [ ] One table with a discriminator, or two tables? (Schema check: keeping search index simple matters.)
- [ ] How do we prevent low-effort spam wanteds without killing the funnel?
- [ ] Do wanted ads expire? When?

## Risks
- Empty wanted board looks worse than no wanted board. Need seeded demand before launch.
- Sellers may not engage with wanteds if they have to message proactively.

## How we'd validate
Soft-launch to one suburb. Metric: wanteds posted per week, % that get at least one matching listing within 14 days, % that convert to a chat.
