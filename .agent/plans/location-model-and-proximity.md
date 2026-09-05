# Plan — Location model & proximity grouping

**Status:** **COMPLETE — every phase built and on `main`.** #368 (suburb records),
#371 (header folded onto the shared picker), #372 (one feed assembly step, named
sections), #375 (the distance rule), and Phase 5 (the radius control) closing it out.
The prod backfill ran clean on 2026-08-29: 8 ads scanned, 8 patched, 0 coordinates
dropped, **nothing unresolved**. What is deliberately NOT built is in
"Deliberately excluded" — the server-side near lane is the one entry with a
condition that is already true.
**Created:** 2026-08-29
**Owner:** Amir
**Supersedes:** product vault → `Archive/ResearchLab/ideas/proximity-ranked-feed.md` (curated: `Ideas/Proximity feed & location.md`)

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
- [x] Run on prod (`resilient-pheasant-112`) — done 2026-08-29 by Amir:
      `{adsPatched: 8, adsScanned: 8, coordinatesDropped: 0, salesStamped: 0, unresolved: []}`.
      An empty `unresolved` means every live ad's suburb string matched the dataset, so
      no prod ad is stranded without a locality id.

### Phase 3 — one feed pipeline with a stable boundary *(BUILT)*

**Outcome.** `convex/lib/feedSections.ts` holds the ordered section list; every path
ends at `assembleFeedPage` (`convex/lib/cards.ts`); `AdsGrid` walks the section list
instead of asking "is this one far?"; the wire field is `section`, not `tier`. Note
`getFeed`'s page is now section-grouped rather than strictly `bumpedAt` desc — the
client grouped it that way at render anyway, so nothing user-visible changed.

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

- [x] Rule: **extraction returns a card and a section name. Never a number.** If
      distance is ever shown, the display layer derives it from data already on the card.

**2. Two producers, one shape, enforced by prose.**

- [x] Both paths go through a single assembly step
- [x] One test runs identical inputs through both and asserts identical output — the
      mechanism the comment is currently pretending to be

**3. "How many sections exist" is hardcoded in two places.** The server sorts so near
items survive the page cut (`convex/ads.ts:240`); the client splits by asking *is this
one far?*. Both assume exactly two sections. A third section would mean editing
extraction and display together.

- [x] Extraction emits an **ordered list of named sections** with items under each
- [x] Display renders whatever sections arrive, in the order given, without knowing
      what they mean
- [x] Adding, renaming or merging a section becomes a server-only change

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

### Phase 4 — swap the near/far test *(DONE — #375)*

The insertion point already exists and is a single function:
`sectionFields(location, matches)` in `convex/lib/cards.ts` (renamed from `tierFields`
in Phase 3). Only `matches` changes —
from string equality to the distance rule. Everything downstream (the divider, the
client partition, the byte-identical no-location response) is untouched.

- [x] Haversine helper + the three-clause near test
- [x] `compositeMatchesFilters` uses min-distance over member points
- [x] Buyer preference stores the resolved object (`{localityId, label, lat, lng, sa4}`),
      not just a string, so tiering works before the dataset chunk loads.
      **Capture it at the pick site, never by re-resolving the stored string.**
      24 locality+state+postcode groups in the shipped dataset hold two rows with
      different ids, and none of the 24 share coordinates — O'CONNELL QLD 4680's two
      rows are 80 km apart, ERNESTINA QLD 56 km, GERMAN CREEK SA 47 km; 7 of the 24
      exceed the 25 km near threshold outright, and HAASTS BLUFF NT pairs a real point
      with the `(0,0)` placeholder. Re-resolving a stored string for those is a coin
      flip that can land the near/far test 80 km out. The row is already in hand at
      both pick sites — `Header.tsx:83`, where detection resolves a `match`, and
      `Header.tsx:167`, where `LocationPicker.onChange` hands back the row as its
      second argument — so this costs nothing if known up front. (#371 folded the
      header's own dropdown into the shared picker, so there is no third site.)
- [x] Thresholds live in `appSettings` (numeric, admin-tunable) — not hardcoded
      (`nearRadiusKm`, 1–500, admin Settings → Feed; default lowered to 15 in
      Phase 5 so the admin setting and the buyer's control agree)

**Outcome.** `convex/lib/nearby.ts` holds the whole rule; only the `matches` boolean
handed to `sectionFields` changed. The buyer's record rides in the
`selectedLocationMeta` cookie and reaches all three queries as `locationMeta`.
`convex/nearby.test.ts` covers each clause through `getFeed`, including both
`O'CONNELL, QLD 4680` rows sectioning one ad differently.

**Known ceiling, carried from Phase 3 (not a regression, but now wider):** search and
the fresh rail cut with `.take()` inside the DB query and their location-pinned pass is
still `.eq("location", …)`, so it only guarantees survival for same-suburb near rows —
one near by distance or SA4 can be lost to the cut. `getFeed` is unaffected. The fix is
the server-side near lane in "Deliberately excluded"; raised with Amir rather than
built.

### Phase 5 — the radius control *(DONE)*

**Radius control.** A dropdown of set distances in the header's location panel,
directly under the shared `LocationPicker` — the ladder is **5 / 10 / 15 / 25 / 50 km,
defaulting to 15** (`NEAR_RADIUS_OPTIONS_KM` / `DEFAULT_NEAR_RADIUS_KM`,
`convex/lib/appConfig.ts`). Amir set this ladder on 2026-08-29; it replaces the
5/10/25/50/100/250-at-25 sketch this section used to carry.

- [x] Ladder rendered as a native `<select>`, shown only with a suburb chosen
- [x] Persisted in a `selectedRadiusKm` cookie beside `selectedLocation` /
      `selectedLocationMeta`, and sent UP with all three feed queries as `radiusKm`
- [x] `appSettings.nearRadiusKm` default lowered 25 → 15 to match the control
- [x] Precedence: the buyer's own pick wins; with no pick the admin `appSettings`
      value applies, then the static default. A saved suburb with no saved distance
      gets the default, never an undefined radius.
- [x] Nothing numeric crosses back to the client — the radius travels one way, and no
      distance, score or match reason is returned on a feed entry (the Phase 3 boundary)
- [x] Divider unchanged: `NearbyBoundary` already draws the line only when the near
      group is non-empty and falls back to its banner otherwise

**The cut had to stop depending on the radius.** Handing a buyer a 5 km option made a
latent Phase 4 defect reachable in one click: `assembleFeedPage` ranked the trim
section-first, so on the two CAPPED paths (`ads.getAds`, `ads.getLatestAds` — the feed
paginates and never cuts) an ad that stopped being near lost its place in the ordering
and fell off the end of the page. Narrowing the radius REMOVED ads, which rule 5
forbids. The trim now ranks on `pinned` then `bumpedAt`, and the section only decides render
order. `pinned` means "near at the WIDEST rung the control offers" — a constant, so it
does not move when the buyer narrows their radius, while still covering everything near
at whatever they picked. That buys both properties at once: narrowing can no longer
remove an ad, and an in-area ad is not cut in favour of a newer out-of-area one.
Composites are pinned on the same any-member test, so no card type is protected less
than an equivalent ad (rules 1 and 4). `convex/nearby.test.ts` asserts both.

**Divider — resolved.** Keep it, and only when the first group has something in it.
The loudest complaint in the Facebook seller research is buyers not understanding why
distant items appear; the line answers that before it is asked. With nothing inside the
circle the existing banner leads the grid instead. Worth revisiting once inventory is
dense enough that the first group fills a screen on its own.

### Phase 6 — search paginates *(built, awaiting Amir's merge)*

Amir's decision, 2026-08-30. `ads.getAds` returned one page of 50 with a `pinned`-first
trim, so once 50 nearby matches existed every out-of-area match was removed and there
was no page to scroll to — setting a location strictly SHRANK what search returned,
which rule 5 forbids.

Convex full-text search answers in **relevance order only** and scans at most **1024
rows**, so the index itself cannot be cursored newest-first. The shape built instead:
pool the matches (1024, the platform ceiling), sort by `bumpedAt` desc once, and walk
the ordered pool with a keyset cursor. No trim, so nothing is dropped.

- [x] `SEARCH_LIMIT = 50` → `SEARCH_POOL_LIMIT = 1024`; the pool, not a page size
- [x] `pageOfPool` — keyset cursor on `(bumpedAt, _creationTime, _id)` desc, the same
      total order `feed.getFeed`'s mergedStream uses. Ads and composites share one
      sequence; no ad type has its own lane
- [x] **One cursor PER GROUP, near filled first.** A page takes as much of the near
      group as it can hold; only the leftover room goes to far. Rule 5 in the order rule
      5 states it. A single date-ordered cursor over the whole pool breaks it — an
      in-area match older than a page of out-of-area ones misses page 1 entirely
- [x] **Reverted: reserving half of each page for the far group.** Built that way first,
      on a brief that warranted it with "a boosted out-of-area listing would be
      unreachable". Amir overturned it on 2026-08-30: rule 3 says in terms that a boosted
      ad at the top of EACH group is the compliant outcome, so the warrant was
      overstated — and the split made later pages insert near cards ABOVE content the
      buyer had already scrolled past, which is a real defect where a long near group is
      merely a long list. Near-first is what Amir has meant all along: a buyer with
      nothing inside their distance is TOLD so, and the feed continues outward
- [x] `assembleFeedPage` called with no `limit` on this path — the `pinned`-first trim
      is now dead here and still load-bearing on `ads.getLatestAds`, which still cuts
- [x] No frontend change: `MarketplaceContext` already routes `loadMore` to whichever
      of the two paginated queries is live, and `AdsGrid` already regroups accumulated
      pages by section
- [x] Acceptance test walks ≥2 page boundaries and asserts every entry on a page is
      newer than or equal to every entry on the next WITHIN EACH GROUP; a second test
      fails if out-of-area results become unreachable when nearby fills page 1

**Ceiling, recorded not papered over.** Past ~1024 live matches for one term the pool is
a relevance-selected subset: a very old exact match can be absent from every page, and
because re-stamping `bumpedAt` does not change relevance rank, beyond the cap a Boost
cannot pull an ad into the search pool. Not reachable at current inventory. Trigger: any
single search term matching more than ~1024 live rows. The fix then is a date-ordered
lane (a `bumpedAt` index pass unioned with the relevance pass) — 1024 is the platform
ceiling, not a tuning knob. **Flagged to Amir: this belongs in "Accepted exceptions" or
gets a build, and that is his call, not an agent's.**

## 4. Deliberately excluded

| Not built | Trigger to add |
|---|---|
| Free radius slider | Never. A dropdown of set distances is fewer values to reason about, and it matches Facebook. Shipped in Phase 5 as 5/10/15/25/50 km. |
| Real suburb polygons | Complaints trace to centroid error. Centroids on ~2 km suburbs are sub-km against a 25 km threshold; polygons are ~50 MB. |
| Geocoding service for posting | Never. Network dependency, per-call cost, rate limit, posting-blocker — for what a local nearest-centroid scan already does. (Detection still uses Nominatim; that's a button, not a post path.) |
| Server-side near-lane query | Either of: (a) feed pages get large enough that the client fetches many pages to fill the near section; (b) **still true after Phase 6** — the fresh rail cuts with `.take()` inside the DB query and the pinned pass is still exact-string, so a row near by DISTANCE or SA4 can be cut before any JS runs. Phase 6 removed search's own cut and widened its pool 50 → 1024, shrinking that window by ~20× on the search path without closing it. The near guarantee is only as wide as the pinned pass, which is narrower than the definition of near. Phase 5 made the surviving SET independent of the radius (changing the distance can no longer remove an ad), but it did not widen the pinned pass — that still needs the `sa4Code` lane. **Do NOT build this as an `sa4Code` lane** — measured against the shipped dataset and it
does not work. Of the localities within 15 km of a Sydney suburb, only **26.8%** share
that suburb's SA4 (Melbourne 33.7%, Brisbane 38.4%, national median 58.8%); at 25 km
Sydney falls to 16.2%. An SA4 lane would miss roughly three quarters of the near set in
the metro areas this is for. SA4 works as the near test's third clause, where it widens
coverage in thin areas — it does not work as the pagination lane. |
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

- Rule 5 grouping (the divider, `sectionFields`, client partition) shipped — PRs #361/#362/#363
- Geolocation detection fixed to disambiguate same-named suburbs by postcode
  (`Header.tsx` — was returning RICHMOND NSW for a user in RICHMOND VIC)
