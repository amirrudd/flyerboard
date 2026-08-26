/**
 * Pure merge/dedupe logic for the MarketplaceContext fresh-feed rail.
 *
 * Extracted (NOT rewritten) from MarketplaceContext.refreshAds so the
 * classification rules are unit-testable. The accumulation design itself —
 * `freshAdsRef` surviving query re-emits — is the hard-won fix from commit
 * 8cf9b00 ("disappearing fresh ads"); these helpers only made it
 * bumpedAt-aware for Boost (Jul 2026), and union-aware for the unified feed
 * (Aug 2026).
 *
 * Why bumpedAt-awareness matters: the paginated feed query is frozen at a
 * `maxSortTime` bound captured at mount. A boost re-stamps an ad's `bumpedAt`
 * ABOVE that bound, so the reactive paginated query *ejects* the ad from every
 * open session. The only way back into the display list is via getLatestAds →
 * this merge. An id-only dedupe would classify the boosted ad as
 * "already known" and drop it — reproducing the 8cf9b00 bug class, silently
 * and possibly permanently for the session.
 *
 * Why the rail carries the WHOLE union (ad | bundle | sale): the frozen query
 * can't return a Bundle or Moving Sale published after mount either, so an
 * ads-only rail granted "newest on top" to one ad type and withheld it from
 * two (rules 1, 2 and 4 of `.agent/PRODUCT-RULES.md`).
 */

/**
 * Minimal structural shape shared by a unified-feed entry (`FeedEntry`) and
 * test fixtures. EVERY kind carries the mutable `bumpedAt` sort key — the
 * hydrated composite CARD shapes (convex/lib/cards.ts) expose it too — so
 * composites are classified exactly like ads, Boost included (rules 1 and 3).
 */
export type FeedEntryLike =
  | { kind: "ad"; ad: { _id: string; bumpedAt: number } }
  | { kind: string; card: { _id: string; bumpedAt: number } };

/**
 * The one `kind + id` identity for a feed entry — the dedupe key used
 * everywhere in this module (and by tests asserting on merge results). Two ad
 * types can't collide even if their raw ids ever coincide.
 */
export function entryKey(e: FeedEntryLike): string {
  return "ad" in e ? `${e.kind}:${e.ad._id}` : `${e.kind}:${e.card._id}`;
}

/**
 * The entry's feed sort key. One rule for all three ad types: a boosted Bundle
 * or Moving Sale re-enters an open session exactly like a boosted ad.
 */
export function entrySortKey(e: FeedEntryLike): number {
  return "ad" in e ? e.ad.bumpedAt : e.card.bumpedAt;
}

/**
 * The one place the boost-arrival key is formatted. A boosted ad's identity in
 * the pin-drop/ring-pulse set is `_id` + its current `bumpedAt`, so a *later*
 * boost re-keys (and re-animates) while plain re-renders don't. Formatting this
 * in more than one place (the merge in MarketplaceContext, the render in
 * AdsGrid) risks the two drifting and silently never matching.
 */
export function boostArrivalKey(ad: { _id: string; bumpedAt: number }): string {
  return `${ad._id}:${ad.bumpedAt}`;
}

/**
 * The "New"-badge identity for a brand-new feed entry, shared by the
 * newAdIds producer (MarketplaceContext) and consumer (AdsGrid). An ad keeps
 * its raw `_id` (the pre-composite badge scheme); a composite uses the same
 * `${kind}-${_id}` key AdsGrid already keys its cards on. One formatter so the
 * two sides can't drift and silently never match.
 */
export function newBadgeKey(e: FeedEntryLike): string {
  return "ad" in e ? e.ad._id : `${e.kind}-${e.card._id}`;
}

/**
 * Classify a `getLatestAds` result set against everything the session already
 * holds (fresh rail + paginated query results):
 *
 * - key unknown                          → `brandNew` (gets the New badge).
 * - key known, sort key newer than the held copy → `boosted` (a Boost
 *   replacement — merged at top but deliberately NOT badged "New": its detail
 *   page honestly says "Posted X ago" and a New badge would contradict it).
 * - key known, sort key unchanged → dropped (classic dedupe).
 */
export function classifyLatestEntries<T extends FeedEntryLike>(
  latest: readonly T[],
  held: readonly T[]
): { brandNew: T[]; boosted: T[] } {
  const heldByKey = new Map<string, T>();
  for (const e of held) {
    // First occurrence wins: callers pass the fresh rail first, and a fresh
    // copy is always at least as new as the paginated query's copy.
    const k = entryKey(e);
    if (!heldByKey.has(k)) heldByKey.set(k, e);
  }

  const brandNew: T[] = [];
  const boosted: T[] = [];
  for (const e of latest) {
    const existing = heldByKey.get(entryKey(e));
    if (!existing) {
      brandNew.push(e);
      continue;
    }
    if (entrySortKey(e) > entrySortKey(existing)) {
      boosted.push(e);
    }
    // else: already known and unchanged — drop.
  }
  return { brandNew, boosted };
}

/**
 * Build the next fresh rail: new arrivals merged with the surviving previous
 * rail, in `bumpedAt` desc order. A boosted replacement shadows (removes) its
 * stale prior copy by kind+id so the rail never holds two generations of the
 * same entry.
 *
 * The final sort is load-bearing (rule 2: `bumpedAt` desc is the only feed
 * order): a raw concat renders arrivals in fetch order, so a batch of mixed
 * arrivals — or a new arrival older than a previously railed boost — could
 * sit out of order at the top of the feed. The sort is stable, so the
 * replacement-aware dedupe above it is untouched.
 */
export function mergeFreshRail<T extends FeedEntryLike>(
  fresh: readonly T[],
  brandNew: readonly T[],
  boosted: readonly T[]
): T[] {
  const replaced = new Set(boosted.map(entryKey));
  return [...brandNew, ...boosted, ...fresh.filter((e) => !replaced.has(entryKey(e)))].sort(
    (a, b) => entrySortKey(b) - entrySortKey(a)
  );
}

/**
 * Rebuild the display list: the fresh rail merged AHEAD of the unified feed
 * page, with the fresh copy winning. This single rule both keeps fresh entries
 * alive across query re-emits (8cf9b00) and drops the stale paginated copy of
 * a boosted ad, so an entry never appears twice.
 *
 * Same rule on browse and search. On search the rail is redundant (ads.getAds
 * is live and re-renders on its own) but never harmful — the kind+id dedupe
 * already collapses an entry the live query also returned. One code path beats
 * two that must be kept in sync.
 */
export function mergeAheadOfQuery<T extends FeedEntryLike, E extends FeedEntryLike>(
  fresh: readonly T[],
  queryEntries: readonly E[]
): (T | E)[] {
  const freshKeys = new Set(fresh.map(entryKey));
  return [...fresh, ...queryEntries.filter((e) => !freshKeys.has(entryKey(e)))];
}

/**
 * Watermark rule (Boost Phase 2): advance the per-filter getLatestAds
 * watermark to max(sort key of the results actually merged) — NEVER
 * `Date.now()`. A wall-clock watermark can advance past a boost whose write
 * raced the query snapshot, skipping it once and making it unrecoverable for
 * the session. `previous` is the floor so the watermark never moves backwards.
 *
 * Entries with no sort key (composite cards) don't advance it — a re-fetch is
 * cheap and idempotent; a skipped arrival is not.
 */
export function nextWatermark(
  previous: number,
  merged: readonly FeedEntryLike[]
): number {
  return merged.reduce((max, e) => Math.max(max, entrySortKey(e)), previous);
}
