/**
 * Pure merge/dedupe logic for the MarketplaceContext fresh-ads rail.
 *
 * Extracted (NOT rewritten) from MarketplaceContext.refreshAds so the
 * classification rules are unit-testable. The accumulation design itself —
 * `freshAdsRef` surviving query re-emits — is the hard-won fix from commit
 * 8cf9b00 ("disappearing fresh ads"); these helpers only make it
 * bumpedAt-aware for Boost (Jul 2026).
 *
 * Why bumpedAt-awareness matters: the paginated feed query is frozen at a
 * `maxSortTime` bound captured at mount. A boost re-stamps an ad's `bumpedAt`
 * ABOVE that bound, so the reactive paginated query *ejects* the ad from every
 * open session. The only way back into the display list is via getLatestAds →
 * this merge. An `_id`-only dedupe would classify the boosted ad as
 * "already known" and drop it — reproducing the 8cf9b00 bug class, silently
 * and possibly permanently for the session.
 */

/** Minimal structural shape shared by Doc<"ads"> and test fixtures. */
export interface SortableAd {
  _id: string;
  /** The mutable feed sort key (required since Boost Phase 1B). */
  bumpedAt: number;
}

/**
 * The one place the boost-arrival key is formatted. A boosted ad's identity in
 * the pin-drop/ring-pulse set is `_id` + its current `bumpedAt`, so a *later*
 * boost re-keys (and re-animates) while plain re-renders don't. Formatting this
 * in more than one place (the merge in MarketplaceContext, the render in
 * AdsGrid) risks the two drifting and silently never matching.
 */
export function boostArrivalKey(ad: Pick<SortableAd, "_id" | "bumpedAt">): string {
  return `${ad._id}:${ad.bumpedAt}`;
}

/**
 * Classify a `getLatestAds` result set against everything the session already
 * holds (fresh rail + paginated query results):
 *
 * - `_id` unknown                          → `brandNew` (gets the New badge).
 * - `_id` known, `bumpedAt` newer than the held copy → `boosted` (a Boost
 *   replacement — merged at top but deliberately NOT badged "New": its detail
 *   page honestly says "Posted X ago" and a New badge would contradict it).
 * - `_id` known, `bumpedAt` unchanged      → dropped (classic dedupe).
 */
export function classifyLatestAds<T extends SortableAd>(
  latest: readonly T[],
  held: readonly T[]
): { brandNew: T[]; boosted: T[] } {
  const heldById = new Map<string, T>();
  for (const ad of held) {
    // First occurrence wins: callers pass the fresh rail first, and a fresh
    // copy is always at least as new as the paginated query's copy.
    if (!heldById.has(ad._id)) heldById.set(ad._id, ad);
  }

  const brandNew: T[] = [];
  const boosted: T[] = [];
  for (const ad of latest) {
    const existing = heldById.get(ad._id);
    if (!existing) {
      brandNew.push(ad);
    } else if (ad.bumpedAt > existing.bumpedAt) {
      boosted.push(ad);
    }
    // else: already known and unchanged — drop.
  }
  return { brandNew, boosted };
}

/**
 * Build the next fresh rail: new arrivals first, then the surviving previous
 * rail. A boosted replacement shadows (removes) its stale prior copy by `_id`
 * so the rail never holds two generations of the same ad.
 */
export function mergeFreshRail<T extends SortableAd>(
  fresh: readonly T[],
  brandNew: readonly T[],
  boosted: readonly T[]
): T[] {
  const replacedIds = new Set(boosted.map((ad) => ad._id));
  return [...brandNew, ...boosted, ...fresh.filter((ad) => !replacedIds.has(ad._id))];
}

/**
 * Rebuild the display list: the fresh rail merged AHEAD of the paginated query
 * results, with the fresh copy winning by `_id`. This single rule both keeps
 * fresh ads alive across query re-emits (8cf9b00) and drops the stale
 * paginated copy of a boosted ad, so an `_id` never appears twice.
 */
export function mergeAheadOfQuery<T extends SortableAd>(
  fresh: readonly T[],
  queryResults: readonly T[]
): T[] {
  const freshIds = new Set(fresh.map((ad) => ad._id));
  return [...fresh, ...queryResults.filter((ad) => !freshIds.has(ad._id))];
}

/**
 * Watermark rule (Boost Phase 2): advance the per-filter getLatestAds
 * watermark to max(bumpedAt of the results actually merged) — NEVER
 * `Date.now()`. A wall-clock watermark can advance past a boost whose write
 * raced the query snapshot, skipping it once and making it unrecoverable for
 * the session. `previous` is the floor so the watermark never moves backwards.
 */
export function nextWatermark(previous: number, merged: readonly SortableAd[]): number {
  return merged.reduce((max, ad) => Math.max(max, ad.bumpedAt), previous);
}
