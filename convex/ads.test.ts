// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

// Same loader convention as saleEvents.test.ts / bundles.test.ts.
const modules = loadConvexModules();
function loadConvexModules(): Record<string, () => Promise<unknown>> {
  const all = {
    ...import.meta.glob("./**/*.ts"),
    ...import.meta.glob("./**/*.js"),
  } as Record<string, () => Promise<unknown>>;
  const filtered: Record<string, () => Promise<unknown>> = {};
  for (const [key, loader] of Object.entries(all)) {
    if (key.endsWith(".d.ts")) continue;
    if (/\.(test|spec)\.[cm]?[jt]sx?$/.test(key)) continue;
    filtered[key] = loader;
  }
  return filtered;
}

async function seedUser(t: ReturnType<typeof convexTest>): Promise<Id<"users">> {
  return t.run(async (ctx) =>
    ctx.db.insert("users", { tokenIdentifier: "u1", name: "Amir", isActive: true })
  );
}

async function seedCategory(t: ReturnType<typeof convexTest>): Promise<Id<"categories">> {
  return t.run(async (ctx) => ctx.db.insert("categories", { name: "Other", slug: "other" }));
}

async function insertAd(
  t: ReturnType<typeof convexTest>,
  opts: {
    userId: Id<"users">;
    categoryId: Id<"categories">;
    title: string;
    isSold?: boolean;
    location?: string;
    bumpedAt?: number;
  }
): Promise<Id<"ads">> {
  return t.run(async (ctx) =>
    ctx.db.insert("ads", {
      title: opts.title,
      description: "desc",
      price: 100,
      location: opts.location ?? "Richmond, VIC",
      categoryId: opts.categoryId,
      images: ["r2:flyers/x/1.jpg"],
      userId: opts.userId,
      isActive: true,
      views: 0,
      bumpedAt: opts.bumpedAt ?? Date.now(),
      ...(opts.isSold !== undefined ? { isSold: opts.isSold } : {}),
    })
  );
}

/** A fresh test instance with a seeded user and category (no flags enabled). */
async function fresh() {
  const t = convexTest(schema, modules);
  const userId = await seedUser(t);
  const categoryId = await seedCategory(t);
  return { t, userId, categoryId };
}

type PageEntry =
  | { kind: "ad"; ad: { _id: Id<"ads"> } }
  | { kind: "bundle"; card: { _id: Id<"saleBundles"> } }
  | { kind: "sale"; card: { _id: Id<"saleEvents"> } };

/** The ids of a page/rail result, whatever mix of ad and card entries it holds. */
function pageKeys(page: readonly PageEntry[]) {
  return page.map((e) => (e.kind === "ad" ? e.ad._id : e.card._id));
}

// ──────────────────────────────────────────────────────────────────────────
// getAds (search-only since the unified feed; browse coverage lives in
// feed.test.ts) — sold ads must not browse as available (bundles/Moving Sale
// can mark a standalone ad isSold: true; search shouldn't mislead buyers).
// ──────────────────────────────────────────────────────────────────────────
describe("getAds excludes sold ads", () => {
  test("search: a sold ad is excluded from search results", async () => {
    const { t, userId, categoryId } = await fresh();
    await insertAd(t, { userId, categoryId, title: "Vintage lamp" });
    const sold = await insertAd(t, { userId, categoryId, title: "Vintage sold lamp", isSold: true });

    const result = await t.query(api.ads.getAds, {
      search: "vintage",
      paginationOpts: { numItems: 20, cursor: null },
    });
    const ids = pageKeys(result.page);
    expect(ids).not.toContain(sold);
  });
});

describe("getLatestAds excludes sold ads", () => {
  test("non-search: a sold ad is excluded from the latest-since feed", async () => {
    const { t, userId, categoryId } = await fresh();
    const since = Date.now() - 60_000;
    const available = await insertAd(t, { userId, categoryId, title: "Fresh chair" });
    const sold = await insertAd(t, { userId, categoryId, title: "Fresh sold chair", isSold: true });

    const ads = await t.query(api.ads.getLatestAds, { sinceTimestamp: since });
    const ids = pageKeys(ads);
    expect(ids).toContain(available);
    expect(ids).not.toContain(sold);
  });

  test("search: a sold ad is excluded from the latest-since search results", async () => {
    const { t, userId, categoryId } = await fresh();
    const since = Date.now() - 60_000;
    await insertAd(t, { userId, categoryId, title: "Antique desk" });
    const sold = await insertAd(t, { userId, categoryId, title: "Antique sold desk", isSold: true });

    const ads = await t.query(api.ads.getLatestAds, { search: "antique", sinceTimestamp: since });
    const ids = pageKeys(ads);
    expect(ids).not.toContain(sold);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Search finds composites, newest first (Task A4).
// Rule 1/4: a Bundle or Moving Sale is an ad-shaped thing — a member's title
// makes the card findable. Rule 2: `bumpedAt` desc is the ONLY order; the
// search index only decides which rows are candidates.
// ──────────────────────────────────────────────────────────────────────────
const PAGE = { numItems: 20, cursor: null };

async function enableFlag(t: ReturnType<typeof convexTest>, key: string, enabled = true) {
  await t.run(async (ctx) =>
    ctx.db.insert("featureFlags", { key, enabled, description: key })
  );
}

async function seedBundle(
  t: ReturnType<typeof convexTest>,
  opts: {
    userId: Id<"users">;
    adIds: Id<"ads">[];
    label: string;
    searchText: string;
    bumpedAt: number;
    locations?: string[];
    categoryIds?: Id<"categories">[];
  }
) {
  return t.run(async (ctx) =>
    ctx.db.insert("saleBundles", {
      sellerId: opts.userId,
      label: opts.label,
      bundlePrice: 150,
      adIds: opts.adIds,
      status: "active",
      bumpedAt: opts.bumpedAt,
      searchText: opts.searchText,
      ...(opts.locations !== undefined ? { locations: opts.locations } : {}),
      ...(opts.categoryIds !== undefined ? { categoryIds: opts.categoryIds } : {}),
    })
  );
}

async function seedSale(
  t: ReturnType<typeof convexTest>,
  opts: {
    userId: Id<"users">;
    title: string;
    searchText: string;
    bumpedAt: number;
    slug?: string;
    locations?: string[];
    categoryIds?: Id<"categories">[];
  }
) {
  const saleId = await t.run(async (ctx) =>
    ctx.db.insert("saleEvents", {
      userId: opts.userId,
      slug: opts.slug ?? `sale-${opts.bumpedAt}`,
      title: opts.title,
      suburb: "Richmond, VIC",
      pickupWindowStart: opts.bumpedAt,
      pickupWindowEnd: opts.bumpedAt + 86_400_000,
      status: "active",
      createdAt: opts.bumpedAt,
      bumpedAt: opts.bumpedAt,
      searchText: opts.searchText,
      ...(opts.locations !== undefined ? { locations: opts.locations } : {}),
      ...(opts.categoryIds !== undefined ? { categoryIds: opts.categoryIds } : {}),
    })
  );
  // A sale with no visible member despawns (hydrateSaleCard returns null), so
  // every seeded sale gets one. Titled off-term and sorted far back so it never
  // matches a search or lands inside a browse-rail window under assertion.
  await insertAd(t, {
    userId: opts.userId,
    categoryId: (await t.run((ctx) => ctx.db.query("categories").first()))!._id,
    title: "Sale item",
    location: opts.locations?.[0] ?? "Richmond, VIC",
    bumpedAt: opts.bumpedAt - 10_000_000,
  });
  await t.run(async (ctx) => {
    const item = await ctx.db
      .query("ads")
      .filter((q) => q.eq(q.field("title"), "Sale item"))
      .filter((q) => q.eq(q.field("saleEventId"), undefined))
      .first();
    if (item) await ctx.db.patch(item._id, { saleEventId: saleId });
  });
  return saleId;
}

/** Set an ad's sort key / sale membership after insert (insertAd stamps `now`). */
async function patchAd(
  t: ReturnType<typeof convexTest>,
  adId: Id<"ads">,
  patch: Record<string, unknown>
) {
  await t.run(async (ctx) => ctx.db.patch(adId, patch));
}

describe("getAds searches every ad type, newest first", () => {
  test("a bundle whose member is a desk is found by 'desk'", async () => {
    const { t, userId, categoryId } = await fresh();
    await enableFlag(t, "bundleListing");
    const a = await insertAd(t, { userId, categoryId, title: "Oak desk" });
    const b = await insertAd(t, { userId, categoryId, title: "Office chair" });
    const bundleId = await seedBundle(t, {
      userId,
      adIds: [a, b],
      label: "Home office setup",
      searchText: "Home office setup Oak desk Office chair",
      bumpedAt: Date.now(),
    });

    const r = await t.query(api.ads.getAds, { search: "desk", paginationOpts: PAGE });
    const bundles = r.page.filter((e) => e.kind === "bundle");
    expect(bundles).toHaveLength(1);
    expect(bundles[0].kind === "bundle" && bundles[0].card._id).toBe(bundleId);
  });

  test("a Moving Sale whose member is a desk is found by 'desk'", async () => {
    const { t, userId, categoryId } = await fresh();
    await enableFlag(t, "movingSaleMode");
    const saleId = await seedSale(t, {
      userId,
      title: "Amir's Moving Sale",
      searchText: "Amir's Moving Sale Oak desk",
      bumpedAt: Date.now(),
    });
    const item = await insertAd(t, { userId, categoryId, title: "Oak desk" });
    await patchAd(t, item, { saleEventId: saleId });

    const r = await t.query(api.ads.getAds, { search: "desk", paginationOpts: PAGE });
    const sales = r.page.filter((e) => e.kind === "sale");
    expect(sales).toHaveLength(1);
    expect(sales[0].kind === "sale" && sales[0].card._id).toBe(saleId);
  });

  test("results are newest-first, not relevance-first", async () => {
    const { t, userId, categoryId } = await fresh();
    const now = Date.now();
    const exact = await insertAd(t, { userId, categoryId, title: "sofa" });
    await patchAd(t, exact, { bumpedAt: now - 86_400_000 });
    const newer = await insertAd(t, { userId, categoryId, title: "sofa bed, barely used" });
    await patchAd(t, newer, { bumpedAt: now });

    const r = await t.query(api.ads.getAds, { search: "sofa", paginationOpts: PAGE });
    const ids = pageKeys(r.page);
    expect(ids).toEqual([newer, exact]);
  });

  test("ads and composites interleave by date with no type grouping", async () => {
    const { t, userId, categoryId } = await fresh();
    await enableFlag(t, "bundleListing");
    await enableFlag(t, "movingSaleMode");
    const now = Date.now();

    const newestAd = await insertAd(t, { userId, categoryId, title: "Standing desk" });
    await patchAd(t, newestAd, { bumpedAt: now });

    const m1 = await insertAd(t, { userId, categoryId, title: "Oak desk" });
    const m2 = await insertAd(t, { userId, categoryId, title: "Office chair" });
    const bundleId = await seedBundle(t, {
      userId,
      adIds: [m1, m2],
      label: "Home office setup",
      searchText: "Home office setup Oak desk Office chair",
      bumpedAt: now - 1000,
    });
    // Members must not outrank the cards under test.
    await patchAd(t, m1, { bumpedAt: now - 10_000_000 });
    await patchAd(t, m2, { bumpedAt: now - 10_000_000 });

    const saleId = await seedSale(t, {
      userId,
      title: "Garage clear-out",
      searchText: "Garage clear-out desk lamp",
      bumpedAt: now - 2000,
    });
    const saleItem = await insertAd(t, { userId, categoryId, title: "Desk lamp" });
    await patchAd(t, saleItem, { saleEventId: saleId, bumpedAt: now - 10_000_000 });

    const oldAd = await insertAd(t, { userId, categoryId, title: "Corner desk" });
    await patchAd(t, oldAd, { bumpedAt: now - 3000 });

    const r = await t.query(api.ads.getAds, { search: "desk", paginationOpts: PAGE });
    const ids = pageKeys(r.page);
    expect(ids.slice(0, 4)).toEqual([newestAd, bundleId, saleId, oldAd]);
  });

  test("a disabled flag excludes that composite type", async () => {
    const { t, userId, categoryId } = await fresh();
    await enableFlag(t, "bundleListing", false);
    await enableFlag(t, "movingSaleMode", false);
    const a = await insertAd(t, { userId, categoryId, title: "Oak desk" });
    const b = await insertAd(t, { userId, categoryId, title: "Office chair" });
    await seedBundle(t, {
      userId,
      adIds: [a, b],
      label: "Home office setup",
      searchText: "Home office setup Oak desk Office chair",
      bumpedAt: Date.now(),
    });
    const saleId = await seedSale(t, {
      userId,
      title: "Garage clear-out",
      searchText: "Garage clear-out Oak desk",
      bumpedAt: Date.now(),
    });
    const item = await insertAd(t, { userId, categoryId, title: "Desk lamp" });
    await patchAd(t, item, { saleEventId: saleId });

    const r = await t.query(api.ads.getAds, { search: "desk", paginationOpts: PAGE });
    expect(r.page.every((e) => e.kind === "ad")).toBe(true);
  });
});

describe("getLatestAds search branch", () => {
  test("returns composites and orders strictly by bumpedAt desc", async () => {
    const { t, userId, categoryId } = await fresh();
    await enableFlag(t, "bundleListing");
    const now = Date.now();
    const since = now - 60_000;

    const exact = await insertAd(t, { userId, categoryId, title: "desk" });
    await patchAd(t, exact, { bumpedAt: now - 30_000 });
    const newer = await insertAd(t, { userId, categoryId, title: "desk lamp, barely used" });
    await patchAd(t, newer, { bumpedAt: now - 1_000 });

    const m1 = await insertAd(t, { userId, categoryId, title: "Oak desk" });
    const m2 = await insertAd(t, { userId, categoryId, title: "Office chair" });
    await patchAd(t, m1, { bumpedAt: since - 10_000 });
    await patchAd(t, m2, { bumpedAt: since - 10_000 });
    const bundleId = await seedBundle(t, {
      userId,
      adIds: [m1, m2],
      label: "Home office setup",
      searchText: "Home office setup Oak desk Office chair",
      bumpedAt: now - 20_000,
    });

    const entries = await t.query(api.ads.getLatestAds, {
      search: "desk",
      sinceTimestamp: since,
    });
    const ids = pageKeys(entries);
    expect(ids).toEqual([newer, bundleId, exact]);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Rule 5: location groups, it doesn't hide. Search tiers every ad type on the
// derived `locations` list; out-of-area results come back tiered "far", never
// dropped — and the near set survives the relevance cap via a pinned pass.
// ──────────────────────────────────────────────────────────────────────────
describe("search tiers results by location instead of hiding them (rule 5)", () => {
  test("an out-of-area bundle is tiered far, an in-area ad near", async () => {
    const { t, userId, categoryId } = await fresh();
    await enableFlag(t, "bundleListing");
    const now = Date.now();

    const localAd = await insertAd(t, { userId, categoryId, title: "Oak desk", location: "Richmond, VIC" });

    const f1 = await insertAd(t, { userId, categoryId, title: "Far desk", location: "Bondi, NSW" });
    const f2 = await insertAd(t, { userId, categoryId, title: "Far chair", location: "Bondi, NSW" });
    const farBundle = await seedBundle(t, {
      userId,
      adIds: [f1, f2],
      label: "Far office setup",
      searchText: "Far office setup Far desk Far chair",
      bumpedAt: now,
      locations: ["Bondi, NSW"],
    });

    const r = await t.query(api.ads.getAds, {
      search: "desk",
      location: "Richmond, VIC",
      paginationOpts: PAGE,
    });
    const tiers = new Map(r.page.map((e) => ["ad" in e && e.kind === "ad" ? e.ad._id : e.card._id, e.tier]));
    expect(tiers.get(localAd)).toBe("near");
    expect(tiers.get(farBundle)).toBe("far");
    // Near block first, then far — bumpedAt desc within each.
    const firstFar = r.page.findIndex((e) => e.tier === "far");
    expect(r.page.slice(0, firstFar).every((e) => e.tier === "near")).toBe(true);
  });

  test("a Moving Sale with no derived location tiers far, not hidden", async () => {
    const { t, userId } = await fresh();
    await enableFlag(t, "movingSaleMode");
    const saleId = await seedSale(t, {
      userId,
      title: "Garage clear-out",
      searchText: "Garage clear-out desk",
      bumpedAt: Date.now(),
      // no `location` — a composite with no live members
    });

    const r = await t.query(api.ads.getAds, {
      search: "desk",
      location: "Richmond, VIC",
      paginationOpts: PAGE,
    });
    const sale = r.page.find((e) => e.kind === "sale" && e.card._id === saleId);
    expect(sale?.tier).toBe("far");
  });

  test("with no location set, search results carry no tier", async () => {
    const { t, userId, categoryId } = await fresh();
    await insertAd(t, { userId, categoryId, title: "Oak desk" });

    const r = await t.query(api.ads.getAds, { search: "desk", paginationOpts: PAGE });
    expect(r.page.length).toBeGreaterThan(0);
    for (const entry of r.page) expect("tier" in entry).toBe(false);
  });

  test("an in-area match outranked by 60 out-of-area matches still returns (pinned pass)", async () => {
    const { t, userId, categoryId } = await fresh();
    const now = Date.now();

    // 60 newer out-of-area matches would fill the 50-row relevance cap and the
    // post-merge slice; only the pinned near pass + tier-aware trim save it.
    for (let i = 0; i < 60; i++) {
      await insertAd(t, {
        userId,
        categoryId,
        title: `Far desk ${i}`,
        location: "Bondi, NSW",
        bumpedAt: now - i,
      });
    }
    const localAd = await insertAd(t, {
      userId,
      categoryId,
      title: "Old local desk",
      location: "Richmond, VIC",
      bumpedAt: now - 1_000_000,
    });

    const r = await t.query(api.ads.getAds, {
      search: "desk",
      location: "Richmond, VIC",
      paginationOpts: PAGE,
    });
    const ids = pageKeys(r.page);
    expect(ids).toContain(localAd);
    expect(r.page.find((e) => e.kind === "ad" && e.ad._id === localAd)?.tier).toBe("near");
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Defect 2: the per-table relevance cap must apply to already-qualifying rows,
// not eat the budget with rows the category filter is about to discard.
// ──────────────────────────────────────────────────────────────────────────
describe("the relevance cap does not swallow category-qualifying composites", () => {
  test("a qualifying Moving Sale survives a crowd of out-of-category matches", async () => {
    const { t, userId, categoryId: wanted } = await fresh();
    const other = await t.run(async (ctx) =>
      ctx.db.insert("categories", { name: "Junk", slug: "junk" })
    );
    await enableFlag(t, "movingSaleMode");
    const now = Date.now();

    // 60 out-of-category matches, each denser on the search term than the target,
    // and inserted first — so the target loses under any tie-break.
    for (let i = 0; i < 60; i++) {
      await seedSale(t, {
        userId,
        title: `Noise ${i}`,
        searchText: "desk desk desk desk desk",
        bumpedAt: now - 1000 - i,
        slug: `noise-${i}`,
        categoryIds: [other],
      });
    }

    const target = await seedSale(t, {
      userId,
      title: "Wanted sale",
      searchText: "Wanted sale oak desk",
      bumpedAt: now,
      slug: "wanted",
      categoryIds: [wanted],
    });

    const r = await t.query(api.ads.getAds, {
      search: "desk",
      categoryId: wanted,
      paginationOpts: PAGE,
    });
    const ids = pageKeys(r.page);
    expect(ids).toContain(target);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Defect 3: the freshness watermark must be a DB predicate, so the cap keeps
// 50 rows that are relevant AND fresh — not 50 relevant ones we then discard.
// ──────────────────────────────────────────────────────────────────────────
describe("getLatestAds search branch applies the watermark before the cap", () => {
  test("a fresh ad ranking below the relevance cap still reaches the rail", async () => {
    const { t, userId, categoryId } = await fresh();
    const now = Date.now();
    const since = now - 60_000;

    // 60 stale-but-highly-relevant matches fill the relevance pool.
    for (let i = 0; i < 60; i++) {
      await insertAd(t, {
        userId,
        categoryId,
        title: "table table table table",
        bumpedAt: since - 10_000 - i,
      });
    }

    const freshAd = await insertAd(t, {
      userId,
      categoryId,
      title: "Dining table in very good condition",
      bumpedAt: now,
    });

    const entries = await t.query(api.ads.getLatestAds, {
      search: "table",
      sinceTimestamp: since,
    });
    const ids = pageKeys(entries);
    expect(ids).toContain(freshAd);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Defect 4: the browse rail is the only path that re-injects new arrivals into
// the frozen feed. It must carry all three ad types (rules 1, 2 and 4).
// ──────────────────────────────────────────────────────────────────────────
describe("getLatestAds browse branch returns composites", () => {
  test("a newly published bundle interleaves with ads by bumpedAt", async () => {
    const { t, userId, categoryId } = await fresh();
    await enableFlag(t, "bundleListing");
    const now = Date.now();
    const since = now - 60_000;

    const newerAd = await insertAd(t, { userId, categoryId, title: "Standing desk", bumpedAt: now });
    const olderAd = await insertAd(t, { userId, categoryId, title: "Corner desk", bumpedAt: now - 30_000 });
    const m1 = await insertAd(t, { userId, categoryId, title: "Oak desk", bumpedAt: since - 10_000 });
    const m2 = await insertAd(t, { userId, categoryId, title: "Office chair", bumpedAt: since - 10_000 });
    const bundleId = await seedBundle(t, {
      userId,
      adIds: [m1, m2],
      label: "Home office setup",
      searchText: "Home office setup Oak desk Office chair",
      bumpedAt: now - 10_000,
      locations: ["Richmond, VIC"],
    });

    const entries = await t.query(api.ads.getLatestAds, { sinceTimestamp: since });
    const ids = pageKeys(entries);
    expect(ids).toEqual([newerAd, bundleId, olderAd]);
  });

  test("a disabled flag keeps the browse rail ads-only", async () => {
    const { t, userId, categoryId } = await fresh();
    await enableFlag(t, "bundleListing", false);
    const now = Date.now();
    const since = now - 60_000;
    await insertAd(t, { userId, categoryId, title: "Standing desk", bumpedAt: now });
    const m1 = await insertAd(t, { userId, categoryId, title: "Oak desk", bumpedAt: since - 10_000 });
    const m2 = await insertAd(t, { userId, categoryId, title: "Office chair", bumpedAt: since - 10_000 });
    await seedBundle(t, {
      userId,
      adIds: [m1, m2],
      label: "Home office setup",
      searchText: "Home office setup Oak desk Office chair",
      bumpedAt: now - 10_000,
      locations: ["Richmond, VIC"],
    });

    const entries = await t.query(api.ads.getLatestAds, { sinceTimestamp: since });
    expect(entries.every((e) => e.kind === "ad")).toBe(true);
  });

  test("the browse rail tiers composites by location instead of hiding them (rule 5)", async () => {
    const { t, userId, categoryId } = await fresh();
    await enableFlag(t, "bundleListing");
    const now = Date.now();
    const since = now - 60_000;

    const localAd = await insertAd(t, { userId, categoryId, title: "Standing desk", bumpedAt: now });
    const f1 = await insertAd(t, { userId, categoryId, title: "Far desk", location: "Bondi, NSW", bumpedAt: since - 10_000 });
    const f2 = await insertAd(t, { userId, categoryId, title: "Far chair", location: "Bondi, NSW", bumpedAt: since - 10_000 });
    const farBundle = await seedBundle(t, {
      userId,
      adIds: [f1, f2],
      label: "Far office setup",
      searchText: "Far office setup",
      bumpedAt: now - 10_000,
      locations: ["Bondi, NSW"],
    });

    const entries = await t.query(api.ads.getLatestAds, {
      sinceTimestamp: since,
      location: "Richmond, VIC",
    });
    // Near block first, then far; nothing hidden.
    expect(pageKeys(entries)).toEqual([localAd, farBundle]);
    expect(entries.map((e) => e.tier)).toEqual(["near", "far"]);
  });

  test("a near arrival older than `limit` far arrivals still reaches the rail (pinned pass)", async () => {
    const { t, userId, categoryId } = await fresh();
    const now = Date.now();
    const since = now - 60_000;

    // 5 far arrivals newer than the near one; limit 3 cuts by date, so only
    // the pinned near pass keeps the local ad in the rail.
    for (let i = 0; i < 5; i++) {
      await insertAd(t, {
        userId,
        categoryId,
        title: `Far arrival ${i}`,
        location: "Bondi, NSW",
        bumpedAt: now - i,
      });
    }
    const localAd = await insertAd(t, {
      userId,
      categoryId,
      title: "Local arrival",
      location: "Richmond, VIC",
      bumpedAt: since + 1_000,
    });

    const entries = await t.query(api.ads.getLatestAds, {
      sinceTimestamp: since,
      location: "Richmond, VIC",
      limit: 3,
    });
    const ids = pageKeys(entries);
    expect(ids).toContain(localAd);
    expect(entries.find((e) => e.kind === "ad" && e.ad._id === localAd)?.tier).toBe("near");
  });
});
