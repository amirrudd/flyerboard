import { describe, it, expect } from 'vitest';
import {
    classifyLatestAds,
    entryKey,
    mergeFreshRail,
    mergeAheadOfQuery,
    nextWatermark,
} from './freshAdsMerge';

const ad = (id: string, bumpedAt: number) => ({ _id: id, bumpedAt });

describe('classifyLatestAds — replacement-aware dedupe (Boost, Phase 2)', () => {
    it('classifies an unknown _id as brand-new', () => {
        const { brandNew, boosted } = classifyLatestAds(
            [ad('a', 100)],
            [ad('b', 50)]
        );
        expect(brandNew).toEqual([ad('a', 100)]);
        expect(boosted).toEqual([]);
    });

    it('classifies a known _id with a newer bumpedAt as a boost replacement, not brand-new', () => {
        const { brandNew, boosted } = classifyLatestAds(
            [ad('a', 500)],
            [ad('a', 100)]
        );
        expect(brandNew).toEqual([]);
        expect(boosted).toEqual([ad('a', 500)]);
    });

    it('drops a known _id whose bumpedAt is unchanged (classic dedupe)', () => {
        const { brandNew, boosted } = classifyLatestAds(
            [ad('a', 100)],
            [ad('a', 100)]
        );
        expect(brandNew).toEqual([]);
        expect(boosted).toEqual([]);
    });

    it('never demotes to _id-only dedupe: an older-held copy in the fresh rail is still replaced', () => {
        // held = fresh rail first, then paginated results (caller contract)
        const held = [ad('fresh1', 300), ad('a', 100), ad('b', 90)];
        const { brandNew, boosted } = classifyLatestAds([ad('a', 900)], held);
        expect(brandNew).toEqual([]);
        expect(boosted).toEqual([ad('a', 900)]);
    });

    it('partitions a mixed batch correctly (brand-new vs re-bumped vs unchanged)', () => {
        const held = [ad('known', 100), ad('unchanged', 200)];
        const latest = [ad('newbie', 400), ad('known', 350), ad('unchanged', 200)];
        const { brandNew, boosted } = classifyLatestAds(latest, held);
        expect(brandNew.map((a) => a._id)).toEqual(['newbie']);
        expect(boosted.map((a) => a._id)).toEqual(['known']);
        // Badge rule: the boosted ad must never surface in the brand-new set —
        // only brandNew ids are fed to newAdIds (the "New" badge).
        expect(brandNew.some((a) => a._id === 'known')).toBe(false);
    });

    it('uses the fresh-rail copy (first occurrence) when held contains two generations of an _id', () => {
        // Fresh rail holds the boosted copy @500; the paginated query still
        // holds the stale copy @100. A getLatestAds re-emit of @500 must be
        // treated as unchanged, not re-boosted.
        const held = [ad('a', 500), ad('a', 100)];
        const { brandNew, boosted } = classifyLatestAds([ad('a', 500)], held);
        expect(brandNew).toEqual([]);
        expect(boosted).toEqual([]);
    });
});

describe('mergeFreshRail — accumulation with boost replacement', () => {
    it('prepends brand-new and boosted arrivals to the surviving rail', () => {
        const rail = mergeFreshRail([ad('old', 100)], [ad('new', 300)], [ad('boosted', 400)]);
        expect(rail.map((a) => a._id)).toEqual(['new', 'boosted', 'old']);
    });

    it('a boost replacement shadows its stale prior copy in the rail (no two generations)', () => {
        const rail = mergeFreshRail(
            [ad('a', 100), ad('keep', 90)],
            [],
            [ad('a', 900)]
        );
        expect(rail).toEqual([ad('a', 900), ad('keep', 90)]);
    });

    it('earlier fresh ads survive later refreshes (8cf9b00 guarantee)', () => {
        const rail1 = mergeFreshRail([], [ad('first', 100)], []);
        const rail2 = mergeFreshRail(rail1, [ad('second', 200)], []);
        expect(rail2.map((a) => a._id)).toEqual(['second', 'first']);
    });
});

// Unified feed: the query page is a discriminated union; the dedupe key is
// kind + id (the fresh rail is ads-only, so composite entries always pass).
const adEntry = (id: string, bumpedAt: number) => ({ kind: 'ad' as const, ad: ad(id, bumpedAt) });

describe('mergeAheadOfQuery — display rebuild over the unified feed page', () => {
    it('never yields a duplicate kind+id after rebuild (fresh copy wins)', () => {
        const fresh = [ad('boosted', 900), ad('new', 800)];
        const query = [adEntry('boosted', 100), adEntry('other', 90)];
        const rebuilt = mergeAheadOfQuery(fresh, query);
        const keys = rebuilt.map(entryKey);
        expect(new Set(keys).size).toBe(keys.length);
        // The surviving copy of the boosted ad is the fresh (re-bumped) one.
        const survivor = rebuilt.find((e) => e.kind === 'ad' && e.ad._id === 'boosted');
        expect(survivor && 'ad' in survivor ? survivor.ad.bumpedAt : undefined).toBe(900);
        expect(keys).toEqual(['ad:boosted', 'ad:new', 'ad:other']);
    });

    it('keeps fresh ads alive when the query re-emits without them', () => {
        const fresh = [ad('freshOnly', 500)];
        const rebuilt = mergeAheadOfQuery(fresh, [adEntry('q1', 100)]);
        expect(rebuilt.map(entryKey)).toEqual(['ad:freshOnly', 'ad:q1']);
    });

    it('composite cards pass through untouched, even sharing an id with a fresh ad', () => {
        const fresh = [ad('x', 900)];
        const query = [
            { kind: 'bundle' as const, card: { _id: 'x' } }, // same raw id, different kind
            adEntry('x', 100), // stale copy — shadowed by the fresh rail
            { kind: 'sale' as const, card: { _id: 's1' } },
        ];
        const rebuilt = mergeAheadOfQuery(fresh, query);
        expect(rebuilt.map(entryKey)).toEqual(['ad:x', 'bundle:x', 'sale:s1']);
    });

    it('full boost round-trip: eject → recover via rail → exactly one copy at top', () => {
        // Session holds A@100, B@90 from the paginated query. A is boosted to
        // 500 (the reactive query will eject it). getLatestAds returns A@500.
        const query = [adEntry('A', 100), adEntry('B', 90)];
        const { brandNew, boosted } = classifyLatestAds([ad('A', 500)], [ad('A', 100), ad('B', 90)]);
        const rail = mergeFreshRail([], brandNew, boosted);
        // Rebuild against the ORIGINAL query snapshot (worst case: stale copy
        // still present) — the rail copy must shadow it.
        const rebuilt = mergeAheadOfQuery(rail, query);
        expect(rebuilt.map(entryKey)).toEqual(['ad:A', 'ad:B']);
        expect(rebuilt[0].kind === 'ad' && rebuilt[0].ad.bumpedAt).toBe(500);
        // And against the post-ejection re-emit (A gone from query results).
        const rebuiltAfterEject = mergeAheadOfQuery(rail, [adEntry('B', 90)]);
        expect(rebuiltAfterEject.map(entryKey)).toEqual(['ad:A', 'ad:B']);
    });
});

describe('nextWatermark — max(bumpedAt of merged), never Date.now()', () => {
    it('advances to the max bumpedAt among merged results', () => {
        expect(nextWatermark(100, [ad('a', 300), ad('b', 700), ad('c', 500)])).toBe(700);
    });

    it('is derived from the merged docs, not the wall clock', () => {
        // A wall-clock watermark would be ~Date.now(); the rule pins it to the
        // newest merged bumpedAt so a boost racing the query snapshot is still
        // above the watermark on the next refresh.
        const result = nextWatermark(0, [ad('a', 12345)]);
        expect(result).toBe(12345);
        expect(result).toBeLessThan(Date.now());
    });

    it('never moves backwards (previous is the floor)', () => {
        expect(nextWatermark(1000, [ad('a', 400)])).toBe(1000);
        expect(nextWatermark(1000, [])).toBe(1000);
    });
});
