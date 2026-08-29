# Plan — Location model & proximity grouping

**Status:** Agreed. Phases 0–2 built in PR #368 — the only item left in them is the
prod migration run. Phases 3–5 not started.
**Created:** 2026-08-29
**Owner:** Amir
**Supersedes:** `ResearchLab/ideas/proximity-ranked-feed.md`

---

## 0. What we are building

Modelled on Facebook Marketplace, as observed directly in the product (Amir, Aug 2026)
and corroborated by external research, which found no evidence anywhere of Facebook
hiding out-of-radius results:

1. A centre point (town, city, neighbourhood or postcode) and a radius, both chosen by
   the user. Facebook's is a dropdown of set distances on a map preview.
2. Every ad in the suburbs inside that circle, newest first — one continuous run.
3. Then it keeps going with ads outside the circle. Loading never stops, nothing is
   ever withheld to honour the radius.

That is exactly what the "location groups, never hides" rule already requires. The only
missing piece is the radius itself: today the first group means "same suburb name",
and it should mean "inside the circle".

**Decisions:**

- **The radius sets where the first group ends. It never removes anything.** No rule
  change needed. No amendment to `.agent/PRODUCT-RULES.md`.
- **The user gets a radius control** — a set of distances on a dropdown, following
  Facebook's shape.
- **Open, minor:** whether the boundary is marked with a visible divider or the feed
  simply continues. See Phase 5.

## 1. Problem

`ads.location` is a free-text string; near/far is exact case-sensitive string
equality on it. Three consequences:

1. **No identity.** `"Richmond, VIC"` and `"RICHMOND, VIC 3121"` are different places
   to the DB. 726 locality+state pairs are duplicated within the shipped dataset, and
   suburb names repeat across states — a name is not a key.
2. **"Near" means "identical suburb".** Carlton and Fitzroy are 900 m apart and tier
   as far. A user in a thin suburb gets a 3-item top group. Rule 5's purpose —
   "show their area first, then widen" — is not served by an equality test.
3. **`latitude`/`longitude` exist on `ads` and are never written** (only
   `sampleData.ts`). The fix was anticipated and left unwired.

The lossy boundary is one line — `LocationPicker.pick()` calls `formatLocation(loc)`
and discards `loc.id`, `loc.postcode`, `loc.lat`, `loc.long`.

## 2. Design

Independently produced by a clean-room architecture review (no code shown), then
checked against the shipped dataset. Store four roles, never conflated:

| Role | Field | Type | Note |
|---|---|---|---|
| Identity | `localityId` | `number` | The dataset's own `id`. Verified unique across all 18,559 rows — no need to synthesise a slug. |
| Display | `location` | `string` | Existing field, unchanged. Denormalised label, snapshot semantics. |
| Computation | `latitude`, `longitude` | `number` | Dataset centroid **copied onto the row** — this is what lets a page tier with zero extra lookups. Fields already exist. |
| Coarse region | `sa4Code` | `string` | ABS SA4 (~90 nationally). The adaptive-radius mechanism, and the only viable path to a server-side near-lane later. |
| Provenance | `locationSource` | `"picked" \| "unresolved"` | Marks degraded-mode rows so a later job can repair them. |

**Near/far rule** — client-side, on the page already fetched:

```
near = same localityId
     OR haversine(buyer, listing) <= 25 km
     OR same sa4Code
```

- **25 km** ≈ how far an Australian drives to collect furniture (Newtown→Parramatta is 22 km).
- **The SA4 clause is the non-obvious part.** A flat radius is wrong outside cities —
  Wagga's nearest real neighbours are 40–90 km away, so a fixed 25 km leaves a regional
  buyer with an empty near-lane. SA4s are small in metro and enormous in the bush: an
  adaptive radius for one string comparison.
- **Identity beats geometry** — same-`localityId` is checked first, so a large rural
  locality whose centroid is far from the user still counts as near.

**Degraded posting.** If the dataset fails to load, the field falls back to free text:
write `localityId: undefined`, no centroid, `locationSource: "unresolved"`. Publish
proceeds. **Never write a placeholder centroid** (0,0, state capital, GPO) — a wrong
coordinate is indistinguishable from a right one forever. Unresolved rows tier as far;
they are never hidden.

**Aggregates (Bundles, Moving Sales).** Already store `locations: string[]`. Gain
parallel `localityIds: number[]`, `points: {lat,lng}[]`, `sa4Codes: string[]`.
Classification: **near if ANY member is near** (min-distance over ≤4 points). Rule 1
unchanged — the card still inherits from its members.

**Rule 2 compliance is structural, not incidental:** distance is read exactly once, to
choose a bucket. No score is stored, returned, or compared. Order within each group
stays `bumpedAt` desc, untouched.

## 3. Phases

### Phase 0 — SA4 data prep *(decided: do it now)*

The shipped `public/australian-postcodes.json` has `id, postcode, locality, state,
lat, long` and **no SA4 code**. This is the one field the design needs that the data
lacks, and it is expensive to add after launch (re-resolving every row).

- [x] Source ABS ASGS SAL→SA4 correspondence (or point-in-polygon the 18,559 centroids
      against SA4 boundaries — pick whichever gives cleaner coverage)
- [x] Join into the shipped JSON as a new `sa4` field; keep `id` stable
- [x] Report coverage: how many of 18,559 rows resolve, and what the misses look like
- [x] Check the size delta — file is 1.8 MB today and is fetched on picker open

**Gate:** if SA4 coverage is poor, fall back to `state`+`postcode` as the coarse key
and log the downgrade here. Weaker adaptivity, still not a name string.

**Outcome (PR #368): no downgrade needed.** 18,552 of 18,559 rows resolved (99.96%).
The seven misses are six rows whose source coordinate is the `0,0` placeholder and one
in the Coral Sea. Size: 1.91 MB → 2.13 MB raw, but **245 KB → 250 KB gzipped (+2%)**,
which is what actually crosses the wire on picker open — SA4 codes compress almost
perfectly (89 distinct values).

Note: the dataset's upstream source ships its own `SA4_CODE_2021` column and it is
corrupt (21 distinct values for 108 real regions; Sydney CBD filed under "Sydney -
Sutherland"). Its `SA2_CODE_2021` prefix disagrees with ABS geometry on ~16% of a
random sample. Both were rejected; every row was point-in-polygoned against ABS ASGS
2021 SA4 boundaries instead, which is also self-consistent with the centroid we store.
Regenerate with `scripts/add-sa4-to-postcodes.mjs`.

### Phase 1 — stop discarding the record *(one-way door)*

- [x] `LocationPicker.onChange` passes the whole `LocationData`, not the formatted string
- [x] `ads` gains `localityId`, `sa4Code`, `locationSource`; `latitude`/`longitude` get written
- [x] Every ad write site populates them (post, edit, sale-item creation, seed)
- [x] Degraded path writes `unresolved` with no centroid
- [x] Composites gain the parallel arrays, derived on membership change like `locations`
- [x] Fold PostAd's hand-rolled suburb field into the shared `LocationPicker` — it is
      the one posting path with no degraded fallback, so a failed dataset fetch
      currently blocks submit outright; folding it in also stops the record contract
      having two implementations

**Why now:** if we launch storing only a name, we can never determine which Richmond,
for any existing ad, ever. Migration is free pre-launch and expensive after.

### Phase 2 — backfill & normalise

- [x] Migration: resolve existing `location` strings against the dataset, stamp the
      new fields, mark unresolvable rows `unresolved`
- [x] Fix the free-text seed rows (`convex/seed.ts:238`, `:362`) — currently
      unreachable by any location filter
- [x] Run on dev — dry run and real run reported identical numbers; re-run was a no-op
- [ ] Run on prod (`resilient-pheasant-112`) — **outstanding, Amir**

### Phase 3 — one feed pipeline with a stable boundary *(do before Phase 4)*

**Why before the radius work:** there are currently two separate feed
implementations — the home feed, and the one category and search use. They must
return identical structures, and today that is guaranteed by a comment in
`convex/lib/cards.ts` saying they must. Every new filter gets built twice. Building
the radius before merging them means building the radius twice.

**The requirement, in Amir's words:** the extraction mechanism is simple today and
will evolve; the display layer must not be affected by how it works or how it
changes.

It is already close. The client reads exactly two things per item — the card kind
and its section (`AdsGrid.tsx:138-139`). Three things would wreck that:

**1. Numbers crossing the boundary.** The moment extraction returns a distance, a
match score, or a match reason, the UI will render it, sort on it, or badge it — and
extraction can never change shape again.

- [ ] Rule: **extraction returns a card and a section name. Never a number.** If
      distance is ever shown, the display layer derives it from data already on the card.

**2. Two producers, one shape, enforced by prose.**

- [ ] Both paths go through a single assembly step
- [ ] One test runs identical inputs through both and asserts identical output — the
      mechanism the comment is currently pretending to be

**3. "How many sections exist" is hardcoded in two places.** The server sorts so near
items survive the page cut (`convex/ads.ts:240`); the client splits by asking *is this
one far?*. Both assume exactly two sections. A third section would mean editing
extraction and display together.

- [ ] Extraction emits an **ordered list of named sections** with items under each
- [ ] Display renders whatever sections arrive, in the order given, without knowing
      what they mean
- [ ] Adding, renaming or merging a section becomes a server-only change

**Deliberately NOT built:** strategy interfaces, ranker plug-in points, an experiment
framework. Those are for when a second implementation exists. The freedom comes from
constraining *what crosses the boundary*, not from carving extension points.

**The test to keep applying:** could extraction be thrown away and rewritten with zero
files changed in the UI? After this phase, yes.

**Note on where this is heading.** Amir observed that Facebook ranks its browse feed
with machine learning rather than recency, and flagged it as something the app might
want one day. **That is not in scope and is not being designed for.** It would also
contradict the ordering rule in `.agent/PRODUCT-RULES.md` ("newest on top … never order
by relevance, price, popularity, or any score") and would weaken Boost, whose whole
promise is that newness is the only thing that lifts an ad. Recorded here so the
decision is made deliberately if it is ever made — the boundary above keeps it
possible without committing to it.

### Phase 4 — swap the near/far test *(unblocked)*

The insertion point already exists and is a single function:
`tierFields(location, matches)` in `convex/lib/cards.ts:106`. Only `matches` changes —
from string equality to the distance rule. Everything downstream (the divider, the
client partition, the byte-identical no-location response) is untouched.

- [ ] Haversine helper + the three-clause near test
- [ ] `compositeMatchesFilters` uses min-distance over member points
- [ ] Buyer preference stores the resolved object (`{localityId, label, lat, lng, sa4}`),
      not just a string, so tiering works before the dataset chunk loads
- [ ] Thresholds live in `appSettings` (numeric, admin-tunable) — not hardcoded

### Phase 5 — the radius control, and the divider question

**Radius control.** A dropdown of set distances, following Facebook's shape. Suggested
ladder: 5 / 10 / 25 / 50 / 100 / 250 km, defaulting to 25 km. Stored with the chosen
suburb and persisted across sessions. Values live in `appSettings` so the default is
tunable without a deploy.

**Open question — divider or silent continuation.** Facebook may not draw a visible
line at all; it may just keep going. Recommendation:

- **Keep the divider, but only when the first group has something in it.** A line
  reading "Further from Richmond" appearing after two ads advertises how empty the
  marketplace is. With nothing inside the circle, drop the divider and show one
  continuous newest-first feed.
- Rationale for keeping it at all: the loudest complaint in the Facebook seller
  research is buyers not understanding why distant items appear. A divider answers
  that before it is asked, and it is already built and shipped.
- Rationale for revisiting later: once inventory is dense the first group will fill a
  screen on its own, and the line stops earning its space.

## 4. Deliberately excluded

| Not built | Trigger to add |
|---|---|
| Free radius slider | Never. A dropdown of set distances is fewer values to reason about, and it matches Facebook. See Phase 5. |
| Real suburb polygons | Complaints trace to centroid error. Centroids on ~2 km suburbs are sub-km against a 25 km threshold; polygons are ~50 MB. |
| Geocoding service for posting | Never. Network dependency, per-call cost, rate limit, posting-blocker — for what a local nearest-centroid scan already does. (Detection still uses Nominatim; that's a button, not a post path.) |
| Server-side near-lane query | Feed pages get large enough that the client fetches many pages to fill the near section. `sa4Code` makes this a same-day change. |
| Distance shown on cards | Held back on purpose: a visible number invites the expectation that it orders the list. Rule 2 is absolute. |
| Multiple saved locations ("home + work") | Nobody has asked. |

## 5. Falsifiers

1. **Suburb is not the browsing unit.** If users think "inner west" / "north side", the
   identity should be a named region and the model shifts up a level. Cheap test: watch
   five people describe where they'd buy a couch from.
2. **First group chronically empty at real inventory levels** → the split is worse than
   no location feature. Largely mitigated by the radius: the first group now covers a
   metro area, not one suburb. Handled by hiding the divider when the group is empty.
3. **Everything is near for everyone** (hard metro clustering) → the split conveys
   nothing and is pure UI cost. Mitigation is the radius itself: drop the default so
   the circle means something in a dense city.
4. **SA4 over-includes in metro** (some metro SA4s are large) → drop the region clause
   above an area threshold. Client-side constant, cheap.
5. **Sellers list away from where they live** (storage units, estates, "my parents'") →
   one suburb per listing under-serves them. The array shape on composites means
   ordinary ads can widen later without a schema surprise.

## 6. Cost of reversal

- **Expensive (decide now):** `localityId` as a stable key, copied centroid, `sa4Code`,
  array-shaped composite location, `locationSource`. All require touching every record.
- **Cheap (defer freely):** the 25 km value, whether the SA4 clause stays, section
  labels, the geolocation button, showing distance, a server-side near lane.

## 7. Prior work already landed

- Rule 5 grouping (the divider, `tierFields`, client partition) shipped — PRs #361/#362/#363
- Geolocation detection fixed to disambiguate same-named suburbs by postcode
  (`Header.tsx` — was returning RICHMOND NSW for a user in RICHMOND VIC)
