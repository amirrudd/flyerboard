# Location: group, don't hide

> **For agentic workers:** use superpowers:subagent-driven-development or
> superpowers:executing-plans. Steps use `- [ ]` for tracking.

**Goal:** picking a location stops hiding everything else. Ads in the area come
first (newest-first), then everything else below one labelled divider.

**Status:** Done. Phase A merged via PR #357 (`96d18db`, `ee463c4`, plus review
fixes). Phase B merged via PR #363 (`0299c03`) on 2026-08-26: every surface
tiers `near`/`far` instead of hiding, verified live in browse, search, and the
60s rail. Phase C (radius) is **parked** — see its own section for
the condition that unparks it.

**Rules:** `.agent/PRODUCT-RULES.md` — binding. Rule 5 is what this closes.
**Research:** `ResearchLab/ideas/proximity-ranked-feed.md` — read the OVERRIDING
CONTEXT block before touching Phase C.

---

## What Phase A already shipped

This is the part people get wrong when picking this plan up, so it is stated
before any instruction:

**Location matching already works, for all three ad types.** Composites carry
`locations: string[]`, derived from their member ads and refreshed at every
mutation that changes membership or a member. `compositeMatchesFilters` in
`convex/lib/cards.ts` is the single definition of "does this composite match?",
and both `feed.getFeed` and `ads.getAds` route through it.

**It is a list, not one string, and that was a deliberate correction.** An
earlier draft of this plan said a composite takes its *first* member's location.
`convex/lib/derive.ts` records why that was wrong: a bundle whose second member
sat in another suburb was invisible to that suburb's filter while its member was
not. **Do not reintroduce a single-location or single-coordinate model.**

So the only rule 5 gap left is that a location filter **hides** out-of-area ads
instead of **grouping** them below a divider. Nothing else.

---

# PHASE B — group instead of hide

Rule 5: *"Location groups. It doesn't hide."* Out-of-area ads go below. They
never disappear. A user who picks a suburb with nothing in it must never see an
empty screen.

Ordering is untouched: `bumpedAt` desc inside each group (rule 2). Distance
decides nothing — "in the area" is the same string equality the filter already
uses.

**Three surfaces hide today**, and all three are in scope or the exception row
stays true: `feed.getFeed`, `ads.getAds` (search), `ads.getLatestAds` (the 60s
rail).

**The shape:** the server stops filtering by location and stamps
`tier: "near" | "far"` on every entry instead. The client partitions at render.
That is the whole design.

> **Composites force tier to be server-computed.** A plain ad entry carries its
> full doc, so the client *could* compare `location` — but the hydrated bundle
> card exposes only `items[0]?.location` and the sale card only `suburb`. The
> derived `locations[]` list never leaves the server, and it is the list that
> decides a match.

> **`tier` must survive hydration.** `hydrateEntries` (`convex/lib/cards.ts`)
> *rebuilds* each entry as `{kind, ad}` / `{kind, card}`, so a `tier` stamped
> before it is silently stripped. Add `tier?: "near" | "far"` to **all three
> members** of the `FeedSourceEntry` union (it is a discriminated union, not one
> object) **and give `hydrateEntries` an explicit return type keeping
> it optional** — `tier: entry.tier` infers a *required* property typed
> `… | undefined`, which breaks the bare `{ kind: 'ad', ad }` literals in
> `src/features/ads/AdsGrid.test.tsx`. Spread conditionally
> (`...(entry.tier && { tier: entry.tier })`) or annotate. `getAds` and
> `getLatestAds` inherit it automatically — both already route through
> `hydrateEntries`.

### Task B1: the feed stops filtering and starts tagging

**Files:** `convex/feed.ts`, `convex/lib/cards.ts`, `convex/feed.test.ts`

> **On splitting B1 and B2.** They share `convex/lib/cards.ts` —
> `compositeMatchesFilters` and `hydrateEntries` are used by `ads.getAds` too.
> Change **call sites only** (recommended, and what B1 says): B1 is then
> independently landable and search is untouched until B2. If you instead edit
> the helper's body, the two must land in one commit — otherwise B1 alone ships
> out-of-area search results with no tier and no divider, a fresh rule 5
> regression.

- [x] **Write the failing test first.** With a location set: no entry is
      missing that today's unfiltered feed would return; every entry carries a
      `tier`; a composite matching any of its `locations` is `near`; with no
      location set the response is byte-identical to today (`undefined` fields
      are dropped before serialisation, so an absent `tier` is genuinely
      absent).

- [x] **One stream, no location filter, stamp the tier.** Remove the location
      clause from the ads `filterWith`, and **stop passing `location` into
      `compositeMatchesFilters` at the feed's two call sites — do not edit that
      helper's body.** Its location clause simply goes unused once B2 stops
      passing the arg from `compositeHits` too. Keep everything else, and tag
      each row:

      ```ts
      // Stamp ONLY when a location is set. An unstamped entry is the default
      // state, and `undefined` fields are dropped before serialisation — that
      // is what keeps the no-location response byte-identical.
      const tier = args.location
        ? (matchesLocation(row, args.location) ? "near" : "far")
        : undefined;
      // ads:        ad.location === args.location
      // composites: compositeMatchesFilters(doc, { location: args.location })
      //             — reuse the helper for the TIER test; only the *filtering*
      //             call sites drop the location arg. Don't copy its predicate.
      ```

      A helper that returns `true` when no location is set would stamp `"near"`
      on every entry in the default case, and the byte-identity test above
      would fail.

      Pagination, cursors and `mergedStream` are **untouched** — one stream, one
      cursor space, exactly today's shape. Category and liveness predicates stay
      where they are: rule 5 says location is a *preference*, category and search
      are *requirements*.

      `ponytail: entries are tagged, not ordered — the client partitions. A near
      ad arriving on page 3 therefore appears above content already scrolled
      past. Accepted: the alternative (load the whole near group on page 1) needs
      a cap whose overflow silently hides ads, and leaves a pinned page-1
      subscription that must scan by_bumped_at across the whole ads table to
      stay inside mergedStream's ordering — by_location exists but is
      [location, _creationTime], so it cannot join the merge — which errors on
      Convex read limits well before the cap binds. Revisit when a suburb's near group no
      longer fits one page — the same condition that unparks Phase C.`

### Task B2: search and the rail need TWO passes, not a filter removal

**Files:** `convex/ads.ts`, `convex/ads.test.ts`

**These caps do not bind at current inventory** — `SEARCH_LIMIT` is 50, and
neither a single search term matching >50 live ads nor >50 ads bumped inside one
60s window happens at ~100 listings. B2 is still worth doing: it is a real rule 5
hole, and the failing tests below are the only thing that will exercise it this
year. Don't read the caps as measured.

Both surfaces cut with a `.take()` **inside the DB query**, above anything the
handler can see. Simply dropping the location filter loses near results before
the merge ever runs — a rule 5 violation manufactured by the rule 5 fix. A
post-hoc partition cannot resurrect them.

- [x] **`searchAllTypes` — two passes.** The existing location-pinned query
      (`.eq("location", …)`, `.take(limit)`) → stamp `tier: "near"`. Then an
      unpinned query `.take(limit)` → stamp `tier: "far"`, dropping any `_id`
      already in the near set. Concatenate, then `mergeAndHydrate` — **and make
      its sort tier-aware, or the slice you are trying to survive deletes the
      near entries all over again.**

      `mergeAndHydrate` sorts `bumpedAt` desc then `.slice(0, limit)`. With two
      passes the pool is up to `2 × limit`, so an older near entry is trimmed
      exactly as the DB cut would have trimmed it:

      ```ts
      const tierRank = (e) => (e.tier === "far" ? 1 : 0);  // undefined ⇒ near
      hits.sort((a, b) => tierRank(a) - tierRank(b) || b.doc.bumpedAt - a.doc.bumpedAt)
      ```

      The trim then eats far entries first. The page comes back as a near block
      then a far block rather than one date-ordered list — which is exactly what
      B3's client partition expects, and `bumpedAt` desc still holds inside each
      block (rule 2). `undefined ⇒ near` matches B3's `e.tier !== "far"`.

      The DB cut here is by **relevance**, so a single unpinned pass may not
      contain the in-area ad at all.

      Failing test first: 60 out-of-area matches newer than one in-area match —
      assert the in-area one is still returned.

- [x] **`getLatestAds` — two passes for the ADS query only.** The cut here is by
      **date**: a near arrival older than `limit` far arrivals in the 60s window
      is dropped. Pin with `.filter(q.eq("location", …))` → `tier: "near"`, then
      unpinned → `tier: "far"`, dedupe on `_id`.

      **Composites need no second pass, on either surface.** There is no location
      index on `saleBundles` or `saleEvents` — `search_composite`'s filterFields
      are `["status"]`, and `latestComposites` reads `by_status_and_bumped_at`.
      `compositeHits` already applies `compositeMatchesFilters` *after*
      `.take(cap)`, as a JS predicate, so location was never a DB-level cut
      there. Just stop passing `location` into it and stamp `tier` from the same
      predicate. (`COMPOSITE_LIMIT`'s doc comment already says this — read it
      before writing a query that can't exist.)

      **One caveat on the rail.** `compositeCap` returns `limit` as soon as
      `sinceTimestamp` is set, and `latestComposites` cuts
      `by_status_and_bumped_at` desc — that IS a DB-level date cut, so a near
      composite below `limit` fresher far ones is still lost. No pinned pass is
      possible without a location index; the fix would be to raise the cap when
      `args.location` is set. **Not in scope for B2** — it needs >50 composites
      bumped inside one 60s window. Recorded so it isn't re-derived.

- [x] **Keep threading `location` into the composite args.** `compositeCap`
      branches on `args.categoryId || args.location`; stop passing it and the
      search cap silently drops from 500 to `limit * 4`.

### Task B3: one divider, and an honest empty state

**Files:** `src/features/ads/NearbyBoundary.tsx` (create),
`src/features/ads/AdsGrid.tsx`, `src/pages/HomePage.tsx`,
`src/features/ads/AdsGrid.test.tsx`

- [x] **Write the failing test first.** Exactly one divider renders, before the
      first `far` entry, however pagination splits the list. With no near
      results, the banner leads instead of a bare divider.

- [x] **Partition at render.** A pure filter of an already-ordered list
      preserves `bumpedAt` desc per group, and this fixes the fresh rail for
      free:

      ```ts
      const near = entries.filter((e) => e.tier !== "far");
      const far  = entries.filter((e) => e.tier === "far");
      ```

      `src/context/freshAdsMerge.ts` needs **no** change — every function there
      is generic over `FeedEntryLike` and passes entries by reference, and the
      rail is keyed by a `cacheKey` that includes the location, so a location
      change starts a fresh rail. Don't extend its union.

- [x] **Plumb what's actually missing.** `AdsGrid` already derives
      `categoryName` from its `categories` prop — that part is free. What it does
      **not** have is `selectedLocation` or a clear-location callback, and it is
      unit-tested bare with no `MarketplaceProvider`, so `NearbyBoundary` cannot
      reach for `useMarketplace()`. Both must come down as props from
      `HomePage`.

- [x] **Mind the grid.** `AdsGrid` is one `<div>` wrapping one `entries.map`, so
      a full-width divider needs `col-span-full` or two grids. If you split into
      two grids: the `staggerCard` index restarts across the boundary, the
      `isLoadingMore` skeletons must move into the far grid, and the header
      count now spans both groups — decide what it should say and pin it.

- [x] **Build `NearbyBoundary`.** Two modes, one component:
      - **Divider** (near results exist) — `Further from {suburb}`.
      - **Banner** (no near results) — `Nothing in {suburb} right now`, plus
        `Showing the newest flyers from further out.` and a clear-location
        action. When a category is active, name it (*"No furniture in Bondi
        right now"*) — otherwise the user blames the location for a
        category-shaped absence.

      Copy says what was **found**, never what **exists**. Use `role="separator"`
      with visible text — **not** a live region: `AdsGrid` has none, and a live
      region announces *changes*, which a static divider isn't.

- [x] **Fix the stale empty state's copy — keep the state.** `AdsGrid.tsx:420-432` renders "No Flyers
      Found / Try a different search term, **widen your location**, or clear the
      active category". Under grouping that state is near-unreachable (far
      entries keep `entries.length > 0`), and its advice is wrong — location no
      longer narrows, so drop "widen your location".

      **Keep it.** Its existing `entries.length === 0` guard is already correct
      and needs no change — near and far partition `entries`, so
      `near.length === 0 && far.length === 0` is the same condition. This step is
      a copy edit, nothing more. Do not delete the block: the banner is guarded
      on a location being *set*, so with no location and no results nothing
      would render at all. Two empty-state vocabularies is the thing to avoid;
      zero is worse.

### Task B4: close the exception

- [x] `npm run lint`, `npx vitest run`, `npm run build`.
- [x] Manually confirm all three surfaces group rather than hide: browse with a
      location, search with a location, and leave a tab open 60s while posting
      an out-of-area ad. **Verified 2026-08-26** against prod (browse, search)
      and local dev (60s rail): a background tab open on a suburb with zero
      near results silently picked up two newly-posted out-of-area ads —
      15 → 17 listings, both slotted into the far group below the banner, no
      reload, nothing hidden.
- [x] Run the `product-guardian` agent. **Expected: the rule 5 exception in
      `.agent/PRODUCT-RULES.md` no longer applies.** Deleting it is the
      definition of done. Four edits go together, or the file contradicts
      itself:
      1. the exception table row (`:137`) — **the table's only row**, so decide
         whether the `## Accepted exceptions` heading and its preamble stay with
         an empty table or go too;
      2. **both** paragraphs of the "Note on the 2026-08-22 widening" (`:139-143`
         and `:145-148`) — the second is about the `proximityFeed` flag and is
         orphaned if only the first goes;
      3. the Notes bullet "Rule 5 describes what it must become — today's
         exact-match location filter contradicts it and is a bug" (`:152-153`).

      Rule 2's and rule 3's "Not violated by" lines already read forward for
      grouping — leave them.
- [x] Update `.agent/gatheredContext/infrastructure/database.md`: all three
      queries stamp `tier`; the client partitions at render; `tier` is
      per-entry, not a page index, because the rail splices arrivals and any
      index would be stale immediately. Record why search and the rail need two
      passes while the feed needs none — the `.take()` sits inside the DB query
      on those two, and that is the thing someone will otherwise re-derive.

# PHASE C — radius (PARKED)

**Do not build this yet.** Amir's design, deferred on sequencing, not rejected.

**What it is:** a user-chosen radius in km (`5 / 10 / 25 / 50 / Anywhere`,
default 10). "In the area" becomes "within R km" rather than "same suburb
string", so a Bondi user sees Bronte too.

**Why it is parked:** it needs coordinates on ads, a geocode backfill, and
distance maths — and at current inventory it buys nothing over Phase B. The
research record is blunt: *"at current inventory the feature ≈ the default state
plus a divider."* The site is pre-launch. Every KPI for it is unmeasurable
because there is nobody to measure.

**The condition that unparks it:** enough real listings that "nearby" and
"everything" are different answers — concretely, when a typical suburb's feed
has more in-area results than fit on one screen, so the divider stops being the
first thing a user sees.

**What it needs when that day comes**, recorded so the research isn't redone:

- **Coordinates on ads.** `convex/schema.ts` already declares
  `latitude`/`longitude`; only `sampleData.ts` writes them. `PostAd.tsx`'s
  location picker already receives `lat`/`long` from `LocationData` and discards
  them. Capture them, and backfill existing rows from
  `public/australian-postcodes.json` — 18,559 rows, 6 without coordinates,
  leaving 18,553 usable rows that collapse to **18,530 distinct
  `(locality, state, postcode)` triples**: the selectable set, and the join key.
  (Don't conflate the two numbers; they measure different things.)
- **Composites take a coordinate LIST, not a point.** Same reason `locations` is
  a list. A composite is in-radius if *any* member is.
- **Haversine, ~8 lines, no dependency.** Sphere approximation, ~0.5% error
  (50 m over 10 km). Fine — distances are only ever shown rounded to 5 km.
- **Distance never orders anything** (rule 2). It only decides which group a card
  is in. `bumpedAt` desc still orders within each.
- **Privacy:** ads sit on suburb centroids. Never show sub-5 km precision;
  trilateration needs resolution this deliberately doesn't have.

**Verified geography, so it isn't re-measured:** a 15 km radius widens catchment
~525× in metro Sydney but only ~29× at the national median. If this ships, it
pays off metro-first.

**Rejected with reasons — do not revisit without new evidence:**

- **Grid-cell / geohash / H3 / S2 spatial index.** Helps only the in-radius
  group, cannot express a ring or a complement, and doesn't fix the sparse-area
  worst case.
- **`@convex-dev/geospatial`.** Ascending sort key only, rectangle queries,
  filters must be denormalised, and it's a separate component so it cannot join
  `mergedStream`.
- **A `proximityFeed` feature flag.** The earlier draft hung its safety story on
  one. It was never built, and `PRODUCT-RULES.md` has already rewritten the
  exception's exit condition in terms of behaviour instead. One user, one
  deployment — a flag is machinery without a job.

---

## Deferred

- **Fuzzy search** — `ResearchLab/ideas/fuzzy-search.md`. "bike" should find
  "bicycle". Independent of this plan and composes cleanly: it changes *which*
  rows search returns; ordering is already `bumpedAt`. ~2 days, no migration.
  **This is the better next thing to build.**
- **Saved-search alerts** — "tell me when something lists in Bondi". The highest-
  value thing on the empty-area surface: it turns absent supply into a return
  visit. `@convex-dev/resend` is already registered.
- **`convex/sampleData.ts` emits unresolvable locations** (`"Sydney, CBD"`,
  `"Melbourne, Fitzroy"`). None resolve against the postcode file, so those
  seeded ads are invisible to the location filter. Fix or delete the file.
