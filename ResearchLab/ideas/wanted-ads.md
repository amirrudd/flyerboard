# Wanted ads (reverse listings — buyers post intent)

- **Status:** Exploring
- **Created:** 2026-05-09
- **Last touched:** 2026-05-09

## Feasibility
- **Build effort:** 3/5 (new table + a matching job; UI is mostly the same as listings — unchanged)
- **Standalone value:** 4/5 (demand-first: works even when supply is thin, and signals what to seed — unchanged)
- **Differentiation:** 4/5 (Meta did *not* touch demand-structuring in their March 2026 launch; Gumtree has a "Wanted" type but it's a checkbox on the same posting flow, not a structured demand surface)
- **Overall:** 4/5 — sleeper pick, now relatively *more* attractive after Meta's March 2026 launch killed wedges on the supply-side ideas. Demand-side is the unclaimed quadrant.

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
- **New:** After Meta's March 2026 AI-listings launch, the supply-side wedges (`ai-photo-to-listing`, `price-estimation`) lost most of their differentiation. Demand-side is the unclaimed surface where Meta has not moved.

## Open questions
- [ ] One table with a discriminator, or two tables? (Schema check: keeping search index simple matters.)
- [ ] How do we prevent low-effort spam wanteds without killing the funnel?
- [ ] Do wanted ads expire? When?
- [ ] **New:** Wanted ads attract a specific scam pattern — fake responder claims to have the item, asks for deposit, ghosts. ACCC 2025 data shows buying/selling scams = the #1 scam type by reports. Need scam-shield wired in before exposing wanted ads to the open web.
- [ ] **New:** Do we expose the buyer's exact location (suburb) or just a rough distance? Tighter privacy = harder for sellers to assess fit.

## Risks
- Empty wanted board looks worse than no wanted board. Need seeded demand before launch.
- Sellers may not engage with wanteds if they have to message proactively.
- **New:** Wanteds-as-honeypot for scammers. Pattern: scammer claims they have the item, requests deposit, vanishes. ACCC data confirms this is a known vector.
- **New:** Privacy. A wanted ad that says "I want a hi-fi system under A$2k within 5km of Brunswick" is also a signal of a buyer with cash, an address, and a high-value item arriving soon. Be deliberate about what's public.

## How we'd validate
Soft-launch to one suburb. Metric: wanteds posted per week, % that get at least one matching listing within 14 days, % that convert to a chat. Add: % flagged by scam-shield as suspicious responders.

## Log
- 2026-05-09 — first sketch.
- 2026-05-09 — feasibility pass: confirmed Gumtree's "Wanted" is a checkbox not a structured surface; Meta's March 2026 launch did *not* touch demand-side, so wanted ads moved from a sleeper pick to a relatively-stronger pick after supply-side wedges weakened. Added scam-honeypot risk and privacy concerns from ACCC 2025 data. Scores unchanged but conviction raised.
