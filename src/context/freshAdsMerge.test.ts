import { describe, it, expect } from 'vitest';
import {
    classifyLatestEntries,
    entryKey,
    entrySortKey,
    mergeFreshRail,
    mergeAheadOfQuery,
    nextWatermark,
} from './freshAdsMerge';

/**
 * One fixture union standing in for `FeedEntry`, so mixed-kind arrays infer a
 * single T (the production caller always passes one union type too).
 */
type Entry =
    | { kind: 'ad'; ad: { _id: string; bumpedAt: number } }
    | { kind: 'bundle'; card: { _id: string; bumpedAt: number } }
    | { kind: 'sale'; card: { _id: string; bumpedAt: number } };

/** An ad entry of the unified feed union. */
const ad = (id: string, bumpedAt: number): Entry => ({ kind: 'ad', ad: { _id: id, bumpedAt } });
/** Composite entries: hydrated cards carry bumpedAt too (see entrySortKey). */
const bundle = (id: string, bumpedAt = 100): Entry => ({ kind: 'bundle', card: { _id: id, bumpedAt } });
const sale = (id: string, bumpedAt = 100): Entry => ({ kind: 'sale', card: { _id: id, bumpedAt } });

describe('classifyLatestEntries — replacement-aware dedupe (Boost, Phase 2)', () => {
    it('classifies an unknown key as brand-new', () => {
        const { brandNew, boosted } = classifyLatestEntries([ad('a', 100)], [ad('b', 50)]);
        expect(brandNew).toEqual([ad('a', 100)]);
        expect(boosted).toEqual([]);
    });

    it('classifies a known id with a newer bumpedAt as a boost replacement, not brand-new', () => {
        const { brandNew, boosted } = classifyLatestEntries([ad('a', 500)], [ad('a', 100)]);
        expect(brandNew).toEqual([]);
        expect(boosted).toEqual([ad('a', 500)]);
    });

    it('drops a known id whose bumpedAt is unchanged (classic dedupe)', () => {
        const { brandNew, boosted } = classifyLatestEntries([ad('a', 100)], [ad('a', 100)]);
        expect(brandNew).toEqual([]);
        expect(boosted).toEqual([]);
    });

    it('never demotes to id-only dedupe: an older-held copy in the fresh rail is still replaced', () => {
        // held = fresh rail first, then paginated results (caller contract)
        const held = [ad('fresh1', 300), ad('a', 100), ad('b', 90)];
        const { brandNew, boosted } = classifyLatestEntries([ad('a', 900)], held);
        expect(brandNew).toEqual([]);
        expect(boosted).toEqual([ad('a', 900)]);
    });

    it('partitions a mixed batch correctly (brand-new vs re-bumped vs unchanged)', () => {
        const held = [ad('known', 100), ad('unchanged', 200)];
        const latest = [ad('newbie', 400), ad('known', 350), ad('unchanged', 200)];
        const { brandNew, boosted } = classifyLatestEntries(latest, held);
        expect(brandNew.map(entryKey)).toEqual(['ad:newbie']);
        expect(boosted.map(entryKey)).toEqual(['ad:known']);
        // Badge rule: the boosted ad must never surface in the brand-new set —
        // only brandNew ids are fed to newAdIds (the "New" badge).
        expect(brandNew.some((e) => entryKey(e) === 'ad:known')).toBe(false);
    });

    it('uses the fresh-rail copy (first occurrence) when held contains two generations of an id', () => {
        // Fresh rail holds the boosted copy @500; the paginated query still
        // holds the stale copy @100. A getLatestAds re-emit of @500 must be
        // treated as unchanged, not re-boosted.
        const held = [ad('a', 500), ad('a', 100)];
        const { brandNew, boosted } = classifyLatestEntries([ad('a', 500)], held);
        expect(brandNew).toEqual([]);
        expect(boosted).toEqual([]);
    });

    it('classifies a newly published composite as brand-new (rules 1, 2 and 4)', () => {
        const { brandNew, boosted } = classifyLatestEntries(
            [bundle('b1'), sale('s1')],
            [ad('a', 100)]
        );
        expect(brandNew.map(entryKey)).toEqual(['bundle:b1', 'sale:s1']);
        expect(boosted).toEqual([]);
    });

    it('classifies a boosted composite as a boost replacement, exactly like an ad (rules 1 and 3)', () => {
        const { brandNew, boosted } = classifyLatestEntries(
            [bundle('b1', 900), sale('s1', 900)],
            [bundle('b1', 100), sale('s1', 100)]
        );
        expect(brandNew).toEqual([]);
        expect(boosted.map(entryKey)).toEqual(['bundle:b1', 'sale:s1']);
    });

    it('drops a composite the session already holds (no double render)', () => {
        const { brandNew, boosted } = classifyLatestEntries([bundle('b1')], [bundle('b1')]);
        expect(brandNew).toEqual([]);
        expect(boosted).toEqual([]);
    });

    it('does not confuse an ad and a composite that share a raw id', () => {
        const { brandNew } = classifyLatestEntries([bundle('x')], [ad('x', 100)]);
        expect(brandNew.map(entryKey)).toEqual(['bundle:x']);
    });
});

describe('entrySortKey', () => {
    it('is bumpedAt for every kind — ads and composite cards alike', () => {
        expect(entrySortKey(ad('a', 42))).toBe(42);
        expect(entrySortKey(bundle('b', 42))).toBe(42);
        expect(entrySortKey(sale('s', 42))).toBe(42);
    });
});

describe('mergeFreshRail — accumulation with boost replacement', () => {
    it('merges brand-new and boosted arrivals with the surviving rail in bumpedAt desc order', () => {
        const rail = mergeFreshRail([ad('old', 100)], [ad('new', 300)], [ad('boosted', 400)]);
        expect(rail.map(entryKey)).toEqual(['ad:boosted', 'ad:new', 'ad:old']);
    });

    it('sorts the whole rail by bumpedAt desc — never concat order (rule 2)', () => {
        // A raw [brandNew, boosted, fresh] concat would yield n(300), b(500),
        // f(400) — the boost and the surviving rail entry both out of order.
        const rail = mergeFreshRail([ad('f', 400)], [ad('n', 300)], [ad('b', 500)]);
        expect(rail.map(entryKey)).toEqual(['ad:b', 'ad:f', 'ad:n']);
        // Composites sort on the same key, interleaved with ads (rules 1, 2, 4).
        const mixed = mergeFreshRail([sale('s', 250)], [bundle('bu', 350), ad('a', 150)], []);
        expect(mixed.map(entryKey)).toEqual(['bundle:bu', 'sale:s', 'ad:a']);
    });

    it('a boost replacement shadows its stale prior copy in the rail (no two generations)', () => {
        const rail = mergeFreshRail([ad('a', 100), ad('keep', 90)], [], [ad('a', 900)]);
        expect(rail).toEqual([ad('a', 900), ad('keep', 90)]);
    });

    it('earlier fresh entries survive later refreshes (8cf9b00 guarantee)', () => {
        const rail1 = mergeFreshRail([], [ad('first', 100)], []);
        const rail2 = mergeFreshRail(rail1, [bundle('second')], []);
        expect(rail2.map(entryKey)).toEqual(['bundle:second', 'ad:first']);
    });
});

describe('mergeAheadOfQuery — display rebuild over the unified feed page', () => {
    it('never yields a duplicate kind+id after rebuild (fresh copy wins)', () => {
        const fresh = [ad('boosted', 900), ad('new', 800)];
        const query = [ad('boosted', 100), ad('other', 90)];
        const rebuilt = mergeAheadOfQuery(fresh, query);
        const keys = rebuilt.map(entryKey);
        expect(new Set(keys).size).toBe(keys.length);
        // The surviving copy of the boosted ad is the fresh (re-bumped) one.
        const survivor = rebuilt.find((e) => entryKey(e) === 'ad:boosted');
        expect(survivor && entrySortKey(survivor)).toBe(900);
        expect(keys).toEqual(['ad:boosted', 'ad:new', 'ad:other']);
    });

    it('keeps fresh entries alive when the query re-emits without them', () => {
        const rebuilt = mergeAheadOfQuery([ad('freshOnly', 500)], [ad('q1', 100)]);
        expect(rebuilt.map(entryKey)).toEqual(['ad:freshOnly', 'ad:q1']);
    });

    it('a fresh composite lands at the top of the frozen page (rules 1 and 2)', () => {
        const rebuilt = mergeAheadOfQuery([bundle('b1'), sale('s1')], [ad('q1', 100)]);
        expect(rebuilt.map(entryKey)).toEqual(['bundle:b1', 'sale:s1', 'ad:q1']);
    });

    it('does not double-render a composite that is also in the query page', () => {
        const rebuilt = mergeAheadOfQuery(
            [bundle('b1')],
            [ad('q1', 100), bundle('b1'), sale('s1')]
        );
        expect(rebuilt.map(entryKey)).toEqual(['bundle:b1', 'ad:q1', 'sale:s1']);
    });

    it('keys on kind, so an ad and a composite sharing a raw id both survive', () => {
        const rebuilt = mergeAheadOfQuery([ad('x', 900)], [bundle('x'), ad('x', 100), sale('s1')]);
        expect(rebuilt.map(entryKey)).toEqual(['ad:x', 'bundle:x', 'sale:s1']);
    });

    it('full boost round-trip: eject → recover via rail → exactly one copy at top', () => {
        // Session holds A@100, B@90 from the paginated query. A is boosted to
        // 500 (the reactive query will eject it). getLatestAds returns A@500.
        const query = [ad('A', 100), ad('B', 90)];
        const { brandNew, boosted } = classifyLatestEntries([ad('A', 500)], query);
        const rail = mergeFreshRail([], brandNew, boosted);
        // Rebuild against the ORIGINAL query snapshot (worst case: stale copy
        // still present) — the rail copy must shadow it.
        const rebuilt = mergeAheadOfQuery(rail, query);
        expect(rebuilt.map(entryKey)).toEqual(['ad:A', 'ad:B']);
        expect(entrySortKey(rebuilt[0])).toBe(500);
        // And against the post-ejection re-emit (A gone from query results).
        const rebuiltAfterEject = mergeAheadOfQuery(rail, [ad('B', 90)]);
        expect(rebuiltAfterEject.map(entryKey)).toEqual(['ad:A', 'ad:B']);
    });

    it('full BOOST round-trip for a Bundle: ejected by the frozen query, recovered via the rail', () => {
        // The session holds the pre-boost Bundle @100 plus two ads. The Bundle
        // is boosted to 900, so the frozen paginated query ejects it; the rail
        // is its only way back — and it must land at the top, not be dropped
        // as "known and unchanged" (rule 3: Boost is a refresh, for every kind).
        const query = [bundle('b1', 100), ad('A', 200), ad('B', 90)];
        const { brandNew, boosted } = classifyLatestEntries([bundle('b1', 900)], query);
        expect(brandNew).toEqual([]);
        expect(boosted.map(entryKey)).toEqual(['bundle:b1']);
        const rail = mergeFreshRail([], brandNew, boosted);
        // Worst case: the stale copy is still in the query snapshot.
        const rebuilt = mergeAheadOfQuery(rail, query);
        expect(rebuilt.map(entryKey)).toEqual(['bundle:b1', 'ad:A', 'ad:B']);
        expect(entrySortKey(rebuilt[0])).toBe(900);
        // And after the reactive ejection (Bundle gone from the query page).
        expect(mergeAheadOfQuery(rail, [ad('A', 200), ad('B', 90)]).map(entryKey)).toEqual([
            'bundle:b1',
            'ad:A',
            'ad:B',
        ]);
    });

    it('full publish round-trip: a Bundle published after the freeze reaches the top', () => {
        // The frozen page can never return it; the rail is its only way in.
        const query = [ad('A', 100), ad('B', 90)];
        const { brandNew } = classifyLatestEntries([bundle('newBundle')], query);
        const rail = mergeFreshRail([], brandNew, []);
        expect(mergeAheadOfQuery(rail, query).map(entryKey)).toEqual([
            'bundle:newBundle',
            'ad:A',
            'ad:B',
        ]);
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

    it('composites advance the watermark too (they carry bumpedAt)', () => {
        expect(nextWatermark(1000, [bundle('b1', 500), sale('s1', 900)])).toBe(1000);
        expect(nextWatermark(1000, [bundle('b1', 3000), ad('a', 2000)])).toBe(3000);
    });
});
