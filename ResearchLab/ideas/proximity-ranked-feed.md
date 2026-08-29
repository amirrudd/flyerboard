# Proximity-ranked feed (soft location filter)

- **Status:** **Superseded** — see `.agent/plans/location-model-and-proximity.md`
- **Created:** 2026-08-15
- **Last touched:** 2026-08-29
- **Owner:** Amir

> **Do not act on this document.** The soft-filter fix it proposed shipped in PRs
> #361/#362/#363 (location groups instead of hiding, divider included), and the
> follow-on design now lives in the plan linked above. What is kept below is the
> durable evidence — geography measurements and competitor observations — that the
> plan builds on. The verdicts, code references and open questions have been removed
> because they no longer describe the codebase.

## Why this was downgraded (2026-08-15)

An initial 4-lens pass (product/UX/business/market) recommended BUILD at rank #1. A
red-team pass overturned it: all four lenses had inherited the same unverified premise
from the orchestrator's prompt. **Four agents agreeing on an unchecked premise is one
error counted four times, not corroboration.** The premise — that location-filtered
sessions were mostly empty — was fabricated by inference, not measured. Worth
remembering as a method lesson.

## Overriding context at the time: no real users

Amir was the only user. Pre-launch, no real listings, no traffic, and no analytics in
the repo — so every KPI proposed was unmeasurable, not merely uninstrumented. Both the
BUILD case and the counter-case argued about behaviour that did not exist.

This still holds as of Aug 2026, and is why the plan puts data-model work first and
leaves tuning until there is something to tune against.

## Verified geography (still true)

From `public/australian-postcodes.json`, haversine self-checked (Sydney→Melbourne =
713 km):

- **18,530 unique canonical "Locality, STATE postcode" strings** are selectable.
- Only **6 of 18,559 records** lack usable lat/long; 24 duplicate
  (locality, state, postcode) keys. The postcode join key is sound.

| Radius | Median localities in range | Sydney | Melbourne | Brisbane |
|---|---|---|---|---|
| 5km | 15 | 119 | 73 | 80 |
| 15km | 29 | 525 | 289 | 256 |
| 50km | 129 | 1,083 | 650 | 679 |
| 100km | 408 | 1,600 | 1,163 | 1,233 |

**A 15 km radius widens catchment ~525× in metro Sydney but only ~29× at the national
median.** Filling a 20-item screen from inside 15 km needs ~0.04 ads/locality in Sydney
vs ~0.7 nationally. If proximity ever pays off, it pays off metro-first — and it is the
measured reason the plan pairs a radius with a coarse regional fallback for thin areas.

## Live competitor evidence (eBay AU, observed first-hand)

Gumtree AU bot-blocks automated browsers, so those questions remain open and need a
manual pass in a signed-in browser. eBay AU was fully testable:

1. **eBay's divider only fires at true zero results.** With local supply, its radius
   hard-locks — 205 results for `sofa` within 10 km of 2000, zero leakage. Only when the
   radius returns nothing does it show the empty state and expanded results together.
2. **A distance badge that echoes the filter radius is useless.** Inside the radius all
   205 cards read "Free pickup: 10 km from 2000" — the filter parroted back. Only below
   the divider does the slot carry real per-item distance.
3. **Divider copy: name the actual relaxation**, not a generic bucket. eBay's own label
   read "from eBay international sellers" over plainly domestic items — a string-reuse
   bug worth not copying.
4. **eBay never shows suburb names** — postcode + km only. For Australian classifieds,
   where "Newtown" means more than "2042", that is a gap to exploit rather than copy.

## Log

- 2026-08-29 — Superseded by `.agent/plans/location-model-and-proximity.md`. The
  proposed fix shipped; stale verdicts, code references and open questions removed.
- 2026-08-15 — Red-team pass overturned the BUILD verdict; downgraded Ready → Exploring.
- 2026-08-15 — Initial 4-lens pass recommended BUILD at #1. Superseded same day.
