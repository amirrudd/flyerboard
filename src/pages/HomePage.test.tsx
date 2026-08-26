import { describe, it, expect } from "vitest";
import { filterFeedForDisplay } from "./HomePage";
import type { FeedEntry } from "../context/MarketplaceContext";
import { entryKey } from "../context/freshAdsMerge";

// Minimal fixtures: only the fields the display filter reads.
const ad = (id: string, price?: number, extra: Record<string, unknown> = {}) =>
    ({ kind: "ad", ad: { _id: id, price, ...extra } }) as unknown as FeedEntry;
const bundle = (id: string, bundlePrice: number) =>
    ({ kind: "bundle", card: { _id: id, bundlePrice } }) as unknown as FeedEntry;
// A Sale carries EVERY member price — it matches when any one of them does.
const sale = (id: string, ...prices: number[]) =>
    ({ kind: "sale", card: { _id: id, minPrice: prices[0] ?? 0, prices } }) as unknown as FeedEntry;

const caps = { saleMemberCap: 3, bundleMemberCap: 2 };
const run = (feed: FeedEntry[], opts: Partial<Parameters<typeof filterFeedForDisplay>[1]> = {}) =>
    filterFeedForDisplay(feed, { ...caps, ...opts }).map(entryKey);

describe("filterFeedForDisplay — price range applies to every ad type (rule 4)", () => {
    it("drops a Bundle priced below the minimum", () => {
        const feed = [ad("a", 800), bundle("cheap", 50), bundle("rich", 900)];
        expect(run(feed, { minPrice: 500 })).toEqual(["ad:a", "bundle:rich"]);
    });

    it("drops a Bundle priced above the maximum", () => {
        expect(run([bundle("cheap", 50), bundle("rich", 900)], { maxPrice: 100 })).toEqual([
            "bundle:cheap",
        ]);
    });

    it("filters a Moving Sale on its member price range", () => {
        const feed = [sale("cheap", 20), sale("rich", 700)];
        expect(run(feed, { minPrice: 500 })).toEqual(["sale:rich"]);
        expect(run(feed, { maxPrice: 100 })).toEqual(["sale:cheap"]);
    });

    it("keeps a Sale when ANY member is in range, not just its cheapest (rule 1)", () => {
        // A $5 mug and a $5000 couch: a $500 minimum must not drop the sale,
        // because a member matches. Filtering on the floor alone would.
        const feed = [sale("mixed", 5, 5000)];
        expect(run(feed, { minPrice: 500 })).toEqual(["sale:mixed"]);
        expect(run(feed, { maxPrice: 50 })).toEqual(["sale:mixed"]);
        expect(run(feed, { minPrice: 6000 })).toEqual([]);
        expect(run(feed, { maxPrice: 1 })).toEqual([]);
    });

    it("drops a Sale whose members all sit OUTSIDE the band, however wide it straddles", () => {
        // The $5 mug / $5000 couch sale straddles $100–$200 without holding a
        // single thing in it. A range-overlap test admits it; rule 5 forbids
        // padding a filtered view with items that don't match.
        expect(run([sale("mixed", 5, 5000)], { minPrice: 100, maxPrice: 200 })).toEqual([]);
        // ...and still keeps it once a member really is in the band.
        expect(run([sale("mixed", 5, 150, 5000)], { minPrice: 100, maxPrice: 200 })).toEqual([
            "sale:mixed",
        ]);
    });

    it("drops an entry with no usable price while a range is set — same as a priceless ad", () => {
        const feed = [ad("noPrice"), sale("noPricedItems"), bundle("b1", 300)];
        expect(run(feed, { minPrice: 100 })).toEqual(["bundle:b1"]);
        // No range set: everything shows.
        expect(run(feed)).toEqual(["ad:noPrice", "sale:noPricedItems", "bundle:b1"]);
    });

    it("preserves feed order and never re-sorts (rule 2)", () => {
        const feed = [sale("s", 700), ad("a", 600), bundle("b", 900)];
        expect(run(feed, { minPrice: 100 })).toEqual(["sale:s", "ad:a", "bundle:b"]);
    });
});

describe("filterFeedForDisplay — member caps", () => {
    it("caps how many members of one Sale render as their own listings", () => {
        const feed = [
            sale("s1", 10),
            ...["m1", "m2", "m3", "m4"].map((m) => ad(m, 10, { saleEventId: "s1" })),
        ];
        expect(run(feed, { saleMemberCap: 3 })).toEqual([
            "sale:s1",
            "ad:m1",
            "ad:m2",
            "ad:m3",
        ]);
    });

    it("-1 means unlimited; 0 means only the composite card", () => {
        const feed = [bundle("b1", 10), ad("m1", 10, { bundleId: "b1" }), ad("m2", 10, { bundleId: "b1" })];
        expect(run(feed, { bundleMemberCap: -1 })).toEqual(["bundle:b1", "ad:m1", "ad:m2"]);
        expect(run(feed, { bundleMemberCap: 0 })).toEqual(["bundle:b1"]);
    });
});
