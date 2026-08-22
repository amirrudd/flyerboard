# Fuzzy search (synonyms + recall fixes)

- **Status:** Ready — verdict survived adversarial review 2026-08-15; **implementation plan corrected and simplified**
- **Created:** 2026-08-15
- **Last touched:** 2026-08-15
- **Owner:** Amir

> 4-lens research pass + red-team pass, 2026-08-15. The lexical-first verdict **held under attack and got cheaper**. But the red team found the plan's hardest-looking step was unnecessary, its sequencing was wrong, and two of its four conclusions rested on wrong reasoning. Corrections are folded in below.

## OVERRIDING CONTEXT: the site has no real users (2026-08-15)

Founder confirmed: **Amir is the only real user.** Pre-launch, no traffic, no real listings.

What this changes here:

- **`searchLogs` produces nothing until users arrive.** It stays in v1 only because it must exist *before* the first cohort — you cannot reconstruct their queries retroactively. It is ~10 lines; keep it, expect it to be empty for now, and drop any expectation of seeding the dictionary from it.
- **Every metric in this doc is unmeasurable at N=1.** Zero-result rate, search share, synonym hit rate — all wait for users. The vector gate is therefore moot rather than merely unsatisfiable.
- **The recall fixes still justify themselves.** `searchText` (title+description) and the synonym dictionary are unconditional correctness work: ~2 days, no dependencies, right whether or not anyone is searching yet. They are also prerequisites for anything smarter later.
- Honest framing: this is **cheap groundwork, not a growth lever.** At zero users the bottleneck is getting the first sellers and buyers, not search recall.

## Problem

Search is Convex full-text on **`title` only** (`search_ads` index, `convex/schema.ts:60`; `convex/ads.ts` `getAds`). Three failure modes:

1. **Title-only**: `description` is a *required* field but never searched — "Kids bike $50" hides the discriminating words ("Trek", "20-inch") in the body. Biggest recall loss.
2. **No synonyms**: "bicycle" misses "bike"; AU vocabulary makes it worse (esky/cooler, pram/stroller, ute, doona, thongs, couch/sofa/lounge).
3. **No typo tolerance** beyond Convex's prefix-match on the last term ("bycicle" → 0 results).

At thin inventory every zero-result page is a lost buyer. But most zero-result searches at 25 sellers are **inventory gaps, not vocabulary gaps** — search can't conjure supply.

**No search logging exists anywhere.** Confirmed: zero hits across the repo for posthog/amplitude/plausible/mixpanel/gtag; the only instrumentation dep is `@vercel/speed-insights` (web vitals, not events).

## THE KEY CORRECTION — synonym expansion needs no merging at all

The original plan called for "1–3 index searches, merged/deduped, original-term hits ranked first". **That is wrong and would be actively worse than doing nothing extra**, because hand-merging discards Convex's unified BM25 score.

**Convex ORs search terms.** Verified empirically with a temporary `convex-test` probe against the real `api.ads.getAds` — three seeded ads, one query `"bike bicycle"`, both the bike and bicycle ads returned, unrelated ad excluded. Relevance is BM25 + number of exact matches, which only makes sense under OR semantics.

So the whole implementation is a string join before the existing call:

```ts
q.search("searchText", expandSynonyms(args.search))  // "bike" -> "bike bicycle"
```

**And the pagination contract it might have broken doesn't exist.** `convex/ads.ts:52-58` does `.take(50)` and returns hardcoded `{ page: ads, isDone: true, continueCursor: "" }`. The comment at `:11-13` says so outright. `MarketplaceContext.tsx:138-149` destructures `loadMore`, but with `isDone: true` on page one it's a permanent no-op on the search path. Same at `CommandPalette.tsx:46-49`.

Net: the lexical fix is **cheaper than claimed**, which widens the gap against vectors rather than narrowing it.

## v1 scope — ship all four together (~2 days)

1. **`searchText` field**: write as `title + " " + title + " " + description`. The doubled title makes BM25 term frequency weight title hits above description hits — **no second index, no merge, no extra query**. Re-point `search_ads` at it; backfill via `convex/migrations.ts` (widen-migrate-narrow precedent exists from the `bumpedAt` rollout, `convex/schema.ts:41-51`). Write sites: `convex/posts.ts:78` and `:166`.
   - Ceiling: TF saturation caps how far this tilts the scale. Upgrade to a second index only if logs show description hits outranking title hits. `ads` uses 1 of Convex's 4 permitted search indexes.
2. **AU synonym dictionary**: ~50 curated pairs in `convex/lib/`, joined into the query string. Applies to `getAds` **and** `getLatestAds` (second search call site — don't miss it). Hardcoded, not admin-editable.
   - **Guard required**: Convex caps search at **16 terms**. `.slice(0, 16)` after expansion, prioritising original terms over synonyms.
3. **`searchLogs` table**: `{ query, normalizedQuery, resultCount, categoryId?, location?, timestamp }`. Queries can't write — log client-side alongside the query call. Cron-prune like `imageCleanup`.
4. **Zero-results state** (`AdsGrid.tsx:419-431` is currently a static dead end — "No Flyers Found", no query echo, no action): named-query headline → category chips → **"Keep an eye out for me"** saved-search alert CTA (seeds [wanted-ads.md](wanted-ads.md)) → "Browse everything".

**A11y fixes rolled in**: one `aria-live="polite"` region announcing settled result counts; `CommandPalette` gets `role="combobox"`/`aria-expanded` (existing gap); unify debounce at 300ms (header is 500ms, palette 200ms).

Also nearly free while touching these mutations: `description` is capped at `maxLength={1500}` client-side (`PostAd.tsx:589`) but the server accepts bare `v.string()` (`posts.ts:51,116`). Add a length validator.

## CORRECTED: sequencing — do NOT log first

The original draft contradicted itself (line "ship together, ~2 days" vs "collect 2–4 weeks of baseline first"). Resolve in favour of **shipping all four together**:

- At ~25 sellers, a 2–4 week baseline cannot statistically separate a 15% zero-result rate from 25%.
- The log's real value is **qualitative** — reading literal zero-result query strings to seed the dictionary and learn what supply to recruit. That needs no baseline period and no statistical power.

## CORRECTED: the vector gate as originally written is unsatisfiable

The gate required *"search share >25–30% of discovery sessions"* — **that metric cannot be computed from `searchLogs`**, which has no session identifier and no denominator of non-search sessions. Either add a session id plus a companion feed-view event, or drop the search-share half and gate on zero-result rate alone.

## CORRECTED: vectors deferred — right call, wrong reason

The founder-time argument ("1–2 weeks") **is padded** — Convex has native `vectorIndex` and a competent build is closer to 2–4 days. The decisive argument is architectural, not schedule-based:

- `ctx.vectorSearch` is **action-only**. Search moves from a reactive `useQuery` to an imperative action.
- It returns bare `{ _id, _score }` — every hit needs a second round trip to hydrate, and Convex docs warn results may be deleted/mutated because transactional queries aren't possible after an action. For a marketplace whose entire `getAds` filter chain is `isDeleted`/`isSold`/`isActive` correctness (`convex/ads.ts:47-51`), **that's a correctness regression, not a latency one** — and this codebase already carries that scar (`convex/ads.test.ts:61` exists because sold ads once leaked into browse).
- Embedding generation needs a scheduled action on every `createAd`/`updateAd` plus a backfill. No AI SDK exists in `package.json` today — new vendor, new key, new failure mode on the post-an-ad path, the one flow that can't get flakier at 25 sellers.

**The "avoid doing lexical work twice" steelman fails**: nothing in v1 is thrown away. `searchText` is exactly what you'd embed; the dictionary becomes the hybrid path's lexical leg; `searchLogs` becomes the relevance-tuning corpus. **Lexical is a prerequisite for vector, not a competing path.**

## CORRECTED: related-concept expansion — "don't interleave", not "don't build"

The original heading overstated the conclusion. The substance is right and narrower:

- The eBay-classifier and Baymard-abandonment evidence comes from catalogues where an exact match **exists and gets displaced**. At 25 sellers nothing is displaced — the counterfactual is a dead-end empty state.
- Correct rule: **a clearly-labelled "Related" section on zero/thin results only, never ranked against real matches.** Sectioned, never interleaved.

**Live evidence that tight matching is achievable** (eBay AU, observed first-hand): `bicycle` returned **zero** motorcycles across 71 sampled titles. Fuzzy matching does not inevitably mean sloppy matching.

## Live competitor evidence (eBay AU, observed 2026-08-15)

Gumtree AU **bot-blocks automated browsers** — direct-competitor questions remain open, need a manual pass in normal Chrome. eBay AU findings:

- **Synonym matching confirmed, bidirectional**: a listing titled just `bicycle` ranks page 1 for `bike`; 53 of 71 `bicycle` results contained "bike" and not "bicycle". Second independent data point alongside the founder's FB Marketplace confirmation.
- **Typos auto-correct by default with an undo link** — `bycicle` → *"Including results for bicycle. Search instead for bycicle"*. Correct-first, not ask-first. **Contradicts** the desk assumption that typo queries dead-end.
- **AU vernacular is asymmetric**: `esky` → `cooler` yes (11/84 cross-matches); `cooler` → `esky` no (0/74). The vernacular term expands to the generic, not vice versa. **Build the dictionary directionally, not as symmetric pairs.**
- **Zero-state = intent capture, not apology**: eBay's entire zero-result page is *"No exact matches found"* + *"Save this search to receive email alerts"* + one button. No suggestions, no illustration. That instinct transfers directly to our zero-state redesign.
- Related-terms strip is **alternative search terms**, not product recommendations — no "you might also like" carousel on results.

## Competitive read

- **Gumtree AU documents literal title-keyword matching** — synonym matching is a genuine gap vs the direct local competitor.
- FB Marketplace synonym-matches (founder-confirmed first-hand); eBay AU too (observed). Table stakes.
- Nobody joins a marketplace for its search; they leave one because search wastes their time. Hygiene factor, not a wedge.

## Metrics

Zero-result rate (primary); synonym-expansion hit rate (% of searches where synonym results filled an otherwise-empty page); search→message conversion. Search share needs a session id — see the gate correction above.

The zero-result query log doubles as **free demand research** — it tells you what supply to seed.

## Stale docs to fix while here

`.agent/gatheredContext/infrastructure/database.md:221-231` documents the search pattern as an index named `search_title` queried with `.collect()`. Reality: `search_ads` (`convex/schema.ts:60`) with `.take(50)` (`convex/ads.ts:52`). `.collect()` on an unbounded search also violates the Convex guidelines' bounded-collection rule.

## Open questions

- [ ] Saved-search alerts ("Keep an eye out for me") in v1, or drop the row rather than fake it?
- [ ] Add a session id to `searchLogs` now (makes the vector gate satisfiable) or gate on zero-result rate alone?
- [ ] Typo tolerance — revisit after logs show whether typos dominate synonyms.

## Related

- `convex/ads.ts:11-13,26-61,47-51,52-58`, `convex/schema.ts:60`, `convex/posts.ts:51,78,116,166`, `src/context/MarketplaceContext.tsx:126-159`, `src/components/ui/CommandPalette.tsx:46-49`, `src/features/ads/AdsGrid.tsx:419-431`, `src/features/ads/PostAd.tsx:589`
- [wanted-ads.md](wanted-ads.md) — the saved-search alert CTA is its seed

## Log

- 2026-08-15 — **Red-team pass: verdict upheld, plan corrected.** Convex ORs search terms (verified by probe) → no merging needed, cheaper than estimated. Ship-together beats log-first. Vector gate was unsatisfiable as written. Vector rejection re-anchored on action-only/transactionality, not schedule. "Don't build related" → "don't interleave". Added: 16-term cap guard, doubled-title BM25 weighting trick.
- 2026-08-15 — Live eBay AU test: synonym matching confirmed bidirectional, typo auto-correction observed, AU vernacular found to be asymmetric, zero-state = intent capture. Gumtree bot-blocked, still untested.
- 2026-08-15 — Founder confirmed first-hand: FB Marketplace synonym-matches (bike↔bicycle).
- 2026-08-15 — Initial 4-lens research pass.
