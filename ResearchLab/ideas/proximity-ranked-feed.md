# Proximity-ranked feed (soft location filter)

- **Status:** Exploring — **downgraded from `Ready` after adversarial review 2026-08-15**
- **Created:** 2026-08-15
- **Last touched:** 2026-08-15
- **Owner:** Amir

> **Read this first.** An initial 4-lens pass (product/UX/business/market) recommended BUILD at rank #1. A subsequent red-team pass **overturned that verdict**. The four lenses had all inherited the same unverified premise from the orchestrator's prompt. Four agents agreeing on an unchecked premise is one error counted four times — not corroboration. What survives is a small real bug fix, not a flagship feature.

## The real, verified defect

`convex/feed.ts:139` and `:165` filter location by exact string equality (`ad.location === args.location`). So "Parramatta" ≠ "Parramatta, NSW 2150". Same in `convex/ads.ts:42-44` (search index `.eq("location", …)`) and `:233-235` (in-memory filter on the fresh rail).

This is real and worth fixing. Everything beyond it is unproven.

## What the red team disproved

### The premise (empty first feeds) is not established — the code suggests the opposite

- `src/context/MarketplaceContext.tsx:60-63` — `selectedLocation` defaults to `""`, which means **no filter** (`feed.ts:165`: `!args.location || …`).
- `src/features/layout/Header.tsx:227-232` — "All Locations" is an explicit menu item setting `""`; it is both the default state and a one-click escape hatch.
- `src/features/layout/Header.tsx:239` — `detectLocation()` fires only on explicit click. **Nothing auto-sets a location.**

So the default first session is the **global newest-first feed**, not an empty one. The "85–95% of location-filtered sessions are empty" figure in the original draft was fabricated by inference, not measured.

### There is no analytics in the repo, so none of the proposed KPIs are measurable

`convex/schema.ts` defines 19 tables; none is analytics. No PostHog / Amplitude / gtag / Plausible / `@vercel/analytics`. The only instrumentation dep is `@vercel/speed-insights` (web vitals, not events). Every KPI in the original draft — empty-first-screen rate, scroll depth past divider, D7 return, filter-clear rate — is currently unobservable.

### "No schema migration needed" is true but irrelevant — distance is not orderable in Convex

Distance is a function of `(ad.location, viewer.location)`. It is **not a property of the row**, so no schema change makes it indexable — storing lat/lng on `ads` would not help either.

- `mergedStream(streams, orderByIndexFields)` requires **real index fields** — `convex-helpers/server/stream.d.ts:480`, and `:463-465` states it only works if streams are already ordered by those fields. No custom-comparator merge, no concat primitive.
- Cursors are index-key positions (`stream.d.ts:435-437`), not positions in a computed ordering.
- `convex/feed.ts:44` hardcodes `FEED_ORDER_FIELDS = ["bumpedAt", "_creationTime", "_id"]`; `:201` merges on it.

The original draft said "server marks the boundary… no client-side sorting" but never said **how**. That is the whole feature, and it was missing from a doc marked `Ready`.

Per-band `filterWith` scans are the only `mergedStream`-compatible route, and `stream.d.ts:57-61` warns `filterWith` makes `.paginate()` read a lot of documents when the predicate excludes most rows — up to 6 full index scans per page under a 6-band scheme. **It's implementable only in the regime where it's pointless, and breaks exactly when inventory arrives.**

### At current inventory the feature ≈ the default state plus a divider

With ~25–100 national listings, tier 2 ("everything else, banded") is approximately every ad in the database. Exact-suburb-first-then-everything, over 25 national ads, is the `selectedLocation = ""` feed with a label and a reorder. The user already starts there and can return in one click.

### Two feed write paths were never considered

- `src/context/MarketplaceContext.tsx:230` — `mergeAheadOfQuery()` prepends new/boosted ads to the **front** of the accumulated feed, outside the paginated query. Under a soft filter this splices far-away ads **above** the local block (violating the design's own non-negotiable) and shifts array indices so a server-supplied `localCount` divider index points at the wrong card.
- Category feed (`feed.ts:136-140`) filters location **in-memory post-paginate**; re-ordering within a page can't produce a globally tiered feed. Search keeps exact `.eq()`. Result: "location" would mean three different things across home / category / search — the *inconsistent* behaviour the market evidence says is the actual complaint.

### It contradicts a locked decision

`ResearchLab/ideas/boost-monetisation.md:20-23` — status `Decided`, rule: *"one shared sort key for the unified paginated feed, **no special cases in the query**"*. Tier-bounded boost is exactly a special case. Boost's promise degrades from "your flyer goes to the top of the feed" to "top of an invisible distance band, for buyers who happen to be in your suburb" — harder to price, explain, and sell, before Boost has been validated at all.

## OVERRIDING CONTEXT: the site has no real users (2026-08-15)

Founder confirmed: **Amir is the only real user.** Pre-launch, no real listings, no traffic.

This is more decisive than any objection below. Both the original 4-lens case *and* the red-team's counter-case argued about user behaviour that does not exist yet:

- The ring test measures real ad locations — there are none (the DB is `sampleData.ts`).
- Every KPI here is unmeasurable not merely because analytics is missing, but because **there is nobody to measure**.
- "85–95% of location-filtered sessions are empty" and "location defaults to unfiltered so it's rarely hit" are *both* moot at zero sessions.

**Consequence: this feature is premature regardless of which side of the argument is right.** It optimises discovery for a funnel with nobody in it. Revisit when there are real users and real listings. What remains worth doing is the ~1-day correctness fix below, on its own merits — it's cheap and unconditionally right.

## Ground-truth test: BLOCKED, and now moot

The decisive test (real ad inventory at 5/15/50km rings) **could not be run** — `npx convex data --prod` returns `401 Unauthorized: MissingAccessToken`; this machine isn't authenticated to Convex Cloud non-interactively. The only reachable data was a stale local SQLite with 44 `sampleData.ts` seed rows.

**To unblock:** run `npx convex dev` once to authenticate, then the ready-made script fills in every table.

## Verified geography facts (these hold regardless)

From `public/australian-postcodes.json` — haversine self-checked (Sydney→Melbourne = 713km):

- **18,530 unique canonical `"Locality, STATE postcode"` strings** are selectable in the picker.
- Only **6 of 18,559 records** lack usable lat/long; 24 duplicate `(locality, state, postcode)` keys. **The postcode join key is sound.**

| Radius | Median localities in range | Sydney | Melbourne | Brisbane |
|---|---|---|---|---|
| 5km | 15 | 119 | 73 | 80 |
| 15km | 29 | 525 | 289 | 256 |
| 50km | 129 | 1,083 | 650 | 679 |
| 100km | 408 | 1,600 | 1,163 | 1,233 |

**New finding no earlier lens produced:** a 15km radius widens catchment ~525× in metro Sydney but only ~29× at the national median. Filling a 20-item screen from inside 15km needs ~0.04 ads/locality in Sydney vs ~0.7 nationally. **If this ever ships, it pays off metro-first.**

## Live competitor evidence (eBay AU, observed first-hand)

Gumtree AU **bot-blocks automated browsers** (HTTP "Access Denied" on every URL) — the direct-competitor questions remain open and need a manual pass in a normal signed-in Chrome. eBay AU was fully testable and produced two findings that cut *against* desk research:

1. **The divider only fires at true zero results.** With local supply, a radius filter hard-locks — 205 results for `sofa` within 10km of 2000, zero leakage, no expansion block. Only when the radius returns nothing does eBay show the empty state **and** expanded results together on one page.
2. **A distance badge that echoes the filter radius is useless.** Inside the radius every one of 205 cards read `"Free pickup: 10 km from 2000"` — the filter parroted back. Only below the divider does the slot become a real per-item distance (`"390 km from 2880"`, ascending).
3. Divider copy pattern: `"<N> items found from <scope>"` — a plain text heading. Note eBay's own label said *"from eBay international sellers"* over plainly domestic items — a string-reuse bug. **Name the actual relaxation ("beyond 10 km", "elsewhere in NSW"), not a generic bucket.**
4. **eBay never shows suburb names** — postcode + km only. For AU classifieds where "Newtown" means more than "2042", that's a gap to exploit, not copy.

## What the evidence actually supports (the lazy fix, ~1 day)

When a location filter is set, **stop hard-filtering**: keep exact matches first, show everything else below one labelled divider. That is `feed.ts:165` returning a sort-rank instead of a boolean, over an ad set small enough to order in memory at current scale.

Delivers 100% of the "never an empty screen" outcome at 25–100 ads, because there is no distance *structure* to expose yet. Must also handle the fresh rail (`MarketplaceContext.tsx:230`) so it can't splice far ads above the local block.

**Deferred until analytics exist AND inventory makes "nearby" ≠ "everything":** distance bands, per-viewer ranking, divider instrumentation, the Boost tier-boundary decision, category/search consistency.

## Also worth fixing (found in passing)

`convex/sampleData.ts` emits location strings like `"Sydney, CBD"` / `"Richmond, VIC"` — **none of its 13 distinct locations resolve** against the postcode file, and none are `formatLocation()` output. Seeded into a real deployment, those ads are invisible to today's filter and ungeocodable by any future proximity work.

`convex/schema.ts:38-39` already declares `latitude` / `longitude` on `ads` — dead schema, written only by `sampleData.ts` (`:84-339`), never by the real posting path (`convex/posts.ts:82,171`).

Stale context docs to correct: `.agent/gatheredContext/infrastructure/database.md:159` lists a `by_location_category` search index that doesn't exist.

## Open questions

- [ ] Authenticate Convex and run the ring analysis — does any version of this earn its place?
- [ ] Do users pick a location at all? **Unanswerable without analytics.** Consider that the actual first task.
- [ ] Manual Gumtree pass in a normal browser to close out the direct-competitor questions.

## Related

- `convex/feed.ts:44,136-140,165,201`, `convex/ads.ts:42-44,233-235`, `convex/schema.ts:38-39,52-54`, `src/context/MarketplaceContext.tsx:60-63,230`, `src/features/layout/Header.tsx:227-239`, `convex-helpers/server/stream.d.ts:57-61,435-437,463-465,480`
- [boost-monetisation.md](boost-monetisation.md) — `Decided`, and this proposal contradicted it

## Log

- 2026-08-15 — **Red-team pass overturned the BUILD verdict.** Premise unverified (location defaults to unfiltered), no analytics to measure any KPI, no workable Convex pagination design, contradicts locked Boost rules. Downgraded `Ready` → `Exploring`. What survives: a ~1-day soft-filter fix. Ground-truth ring test blocked on Convex auth. Verified geography: 18,530 localities, sound join key, metro-first economics.
- 2026-08-15 — Initial 4-lens research pass recommended BUILD at #1. **Superseded — do not act on that version.**
