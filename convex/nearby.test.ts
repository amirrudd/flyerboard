// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { locationMetaFromRow, type LocationMeta } from "./lib/location";
import { NEAR_RADIUS_OPTIONS_KM, SETTING_NEAR_RADIUS_KM } from "./lib/appConfig";

/**
 * The near/far test (convex/lib/nearby.ts) as the feed actually applies it.
 *
 * Every case goes through `feed.getFeed`, so a regression anywhere on the path —
 * the haversine, a dropped clause, the record failing to reach the query — fails
 * here. What is asserted is only ever a SECTION NAME: no distance crosses the
 * boundary to assert on (rule 2 / Phase 3).
 */

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

type T = ReturnType<typeof convexTest>;
const T0 = 1_000_000;

/**
 * The two real `O'CONNELL, QLD 4680` rows from the shipped dataset — same
 * locality, same state, same postcode, different ids, centroids 80 km apart.
 * They are why the buyer's record is captured at the pick site instead of being
 * re-resolved from the stored string: the string cannot tell these two apart,
 * and picking the wrong one moves the near/far boundary 80 km.
 */
const OCONNELL_A = { id: 12490, lat: -23.446826, long: 151.917285, sa4: "308" };
const OCONNELL_B = { id: 23997, lat: -23.856785, long: 151.271287, sa4: "308" };
const OCONNELL = "O'CONNELL, QLD 4680";

/** ~10 km north of row A, ~85 km from row B. Deliberately carries no SA4 and a */
/** locality id of its own, so ONLY the distance clause can call it near. */
const NEAR_A_ONLY = { localityId: 90001, latitude: -23.356826, longitude: 151.917285 };

async function fresh() {
  const t = convexTest(schema, modules);
  const userId = await t.run(async (ctx) =>
    ctx.db.insert("users", { tokenIdentifier: "u1", name: "Tester", isActive: true })
  );
  const categoryId = await t.run(async (ctx) =>
    ctx.db.insert("categories", { name: "Other", slug: "other" })
  );
  return { t, userId, categoryId };
}

async function insertAd(
  t: T,
  opts: {
    userId: Id<"users">;
    categoryId: Id<"categories">;
    bumpedAt: number;
    location?: string;
    localityId?: number;
    latitude?: number;
    longitude?: number;
    sa4Code?: string;
  }
): Promise<Id<"ads">> {
  const { userId, categoryId, bumpedAt, ...rest } = opts;
  return t.run(async (ctx) =>
    ctx.db.insert("ads", {
      title: "Item",
      description: "desc",
      price: 100,
      location: rest.location ?? OCONNELL,
      categoryId,
      images: ["r2:flyers/x/1.jpg"],
      userId,
      isActive: true,
      views: 0,
      bumpedAt,
      locationSource: rest.localityId === undefined ? "unresolved" : "picked",
      ...rest,
    })
  );
}

/** The section `getFeed` stamps on each ad, keyed by ad id. */
async function sectionsFor(
  t: T,
  buyer: { location: string; meta?: LocationMeta }
): Promise<Record<string, string | undefined>> {
  const result = await t.query(api.feed.getFeed, {
    paginationOpts: { numItems: 20, cursor: null },
    location: buyer.location,
    ...(buyer.meta ? { locationMeta: buyer.meta } : {}),
    maxSortTime: T0 + 1000,
  });
  return Object.fromEntries(
    result.page.map((e) => [e.kind === "ad" ? e.ad._id : "", e.section])
  );
}

describe("the near test — three clauses", () => {
  test("same locality id counts as near however far the centroid is", async () => {
    const { t, userId, categoryId } = await fresh();
    // Same id as the buyer's row, but a point on the other side of the country
    // and a different SA4: identity is checked first, and it wins.
    const ad = await insertAd(t, {
      userId,
      categoryId,
      bumpedAt: T0 + 10,
      localityId: OCONNELL_A.id,
      latitude: -31.95,
      longitude: 115.86,
      sa4Code: "501",
    });
    const sections = await sectionsFor(t, {
      location: OCONNELL,
      meta: locationMetaFromRow(OCONNELL_A),
    });
    expect(sections[ad]).toBe("near");
  });

  test("a different suburb inside the radius is near; outside it is far", async () => {
    const { t, userId, categoryId } = await fresh();
    const tenKm = await insertAd(t, {
      userId,
      categoryId,
      bumpedAt: T0 + 10,
      location: "SOMEWHERE, QLD 4680",
      ...NEAR_A_ONLY,
    });
    // ~200 km south, its own locality, no SA4 — no clause can reach it.
    const twoHundredKm = await insertAd(t, {
      userId,
      categoryId,
      bumpedAt: T0 + 20,
      location: "FARAWAY, QLD 4700",
      localityId: 90002,
      latitude: -25.25,
      longitude: 151.917285,
    });
    const sections = await sectionsFor(t, {
      location: OCONNELL,
      meta: locationMetaFromRow(OCONNELL_A),
    });
    expect(sections[tenKm]).toBe("near");
    expect(sections[twoHundredKm]).toBe("far");
  });

  test("the same SA4 region is near even well beyond the radius", async () => {
    const { t, userId, categoryId } = await fresh();
    // 200 km away — outside any radius the admin can set here — but the same
    // ABS region, which is what keeps a regional buyer's near group populated.
    const ad = await insertAd(t, {
      userId,
      categoryId,
      bumpedAt: T0 + 10,
      location: "REGIONAL, QLD 4700",
      localityId: 90003,
      latitude: -25.25,
      longitude: 151.917285,
      sa4Code: OCONNELL_A.sa4,
    });
    const sections = await sectionsFor(t, {
      location: OCONNELL,
      meta: locationMetaFromRow(OCONNELL_A),
    });
    expect(sections[ad]).toBe("near");
  });

  test("an unresolved ad has no record to match, so it groups far — never hidden", async () => {
    const { t, userId, categoryId } = await fresh();
    const ad = await insertAd(t, {
      userId,
      categoryId,
      bumpedAt: T0 + 10,
      location: "somewhere the seller typed",
    });
    const sections = await sectionsFor(t, {
      location: OCONNELL,
      meta: locationMetaFromRow(OCONNELL_A),
    });
    expect(sections[ad]).toBe("far");
  });
});

describe("the buyer's record, not their suburb string", () => {
  /**
   * The trap this whole design exists to avoid. Both rows format to the SAME
   * string, so anything that re-resolves the string instead of carrying the
   * picked row would answer these two identically — and be 80 km wrong for one
   * of them. If this test ever passes with both sections equal, the record has
   * stopped reaching the near test.
   */
  test("two dataset rows sharing one suburb string section an ad differently", async () => {
    const { t, userId, categoryId } = await fresh();
    const ad = await insertAd(t, {
      userId,
      categoryId,
      bumpedAt: T0 + 10,
      location: "SOMEWHERE, QLD 4680",
      ...NEAR_A_ONLY,
    });

    const pickedA = await sectionsFor(t, {
      location: OCONNELL,
      meta: locationMetaFromRow(OCONNELL_A),
    });
    const pickedB = await sectionsFor(t, {
      location: OCONNELL,
      meta: locationMetaFromRow(OCONNELL_B),
    });

    expect(pickedA[ad]).toBe("near");
    expect(pickedB[ad]).toBe("far");
  });

  test("a (0,0) placeholder row yields no point, so it can never be 14,000 km near", async () => {
    // Six dataset rows carry (0, 0) as their own "no coordinate" marker —
    // HAASTS BLUFF NT pairs one with a real point. A placeholder centroid must
    // stay ABSENT: a wrong coordinate is indistinguishable from a right one.
    const placeholder = locationMetaFromRow({ id: 91000, lat: 0, long: 0 });
    expect(placeholder.latitude).toBeUndefined();
    expect(placeholder.longitude).toBeUndefined();

    const { t, userId, categoryId } = await fresh();
    const ad = await insertAd(t, {
      userId,
      categoryId,
      bumpedAt: T0 + 10,
      location: "HAASTS BLUFF, NT 0872",
      localityId: 91001,
      latitude: -23.45,
      longitude: 131.83,
      sa4Code: "702",
    });
    const sections = await sectionsFor(t, { location: "HAASTS BLUFF, NT 0872", meta: placeholder });
    expect(sections[ad]).toBe("far");
  });

  test("a preference stored with no record falls back to the suburb string", async () => {
    const { t, userId, categoryId } = await fresh();
    const sameString = await insertAd(t, { userId, categoryId, bumpedAt: T0 + 10 });
    const tenKmAway = await insertAd(t, {
      userId,
      categoryId,
      bumpedAt: T0 + 20,
      location: "SOMEWHERE, QLD 4680",
      ...NEAR_A_ONLY,
    });
    const sections = await sectionsFor(t, { location: OCONNELL });
    expect(sections[sameString]).toBe("near");
    expect(sections[tenKmAway]).toBe("far");
  });
});

describe("the radius is admin-tunable, not hardcoded", () => {
  test("an ad outside the default radius moves into the near group when it is raised", async () => {
    const { t, userId, categoryId } = await fresh();
    // ~44 km north of row A: outside the 25 km default, inside a 50 km setting.
    const ad = await insertAd(t, {
      userId,
      categoryId,
      bumpedAt: T0 + 10,
      location: "FORTY, QLD 4680",
      localityId: 90004,
      latitude: -23.046826,
      longitude: OCONNELL_A.long,
    });
    const buyer = { location: OCONNELL, meta: locationMetaFromRow(OCONNELL_A) };
    expect((await sectionsFor(t, buyer))[ad]).toBe("far");

    await t.run(async (ctx) =>
      ctx.db.insert("appSettings", {
        key: SETTING_NEAR_RADIUS_KM,
        value: 50,
        description: "test",
      })
    );
    expect((await sectionsFor(t, buyer))[ad]).toBe("near");
  });
});

describe("a composite is near when ANY member is (rule 1)", () => {
  test("a bundle whose nearest member is inside the radius groups near", async () => {
    const { t, userId, categoryId } = await fresh();
    const members = await Promise.all([
      insertAd(t, { userId, categoryId, bumpedAt: Number.MAX_SAFE_INTEGER }),
      insertAd(t, { userId, categoryId, bumpedAt: Number.MAX_SAFE_INTEGER }),
    ]);
    const bundleId = await t.run(async (ctx) =>
      ctx.db.insert("saleBundles", {
        sellerId: userId,
        label: "Bundle",
        adIds: members,
        bundlePrice: 100,
        status: "active",
        bumpedAt: T0 + 10,
        categoryIds: [categoryId],
        locations: ["FARAWAY, QLD 4700", "SOMEWHERE, QLD 4680"],
        localityIds: [90002, NEAR_A_ONLY.localityId],
        // Members are unordered sets: one 200 km away, one 10 km away.
        points: [
          { lat: -25.25, lng: 151.917285 },
          { lat: NEAR_A_ONLY.latitude, lng: NEAR_A_ONLY.longitude },
        ],
        sa4Codes: [],
      })
    );
    await t.run(async (ctx) =>
      ctx.db.insert("featureFlags", { key: "bundleListing", enabled: true, description: "test" })
    );

    const result = await t.query(api.feed.getFeed, {
      paginationOpts: { numItems: 20, cursor: null },
      location: OCONNELL,
      locationMeta: locationMetaFromRow(OCONNELL_A),
      maxSortTime: T0 + 1000,
    });
    const bundle = result.page.find((e) => e.kind === "bundle" && e.card._id === bundleId);
    expect(bundle?.section).toBe("near");
  });
});

/**
 * Phase 5 — the buyer's own radius, and the invariant it must not break.
 *
 * Rule 5: location GROUPS, it never hides. The radius control hands a buyer a
 * one-click way to change the near/far test, so the thing worth proving is that
 * changing it moves ads between sections and never removes one. Asserted as a
 * set comparison on ids, per path, because each path cuts differently:
 * `feed.getFeed` paginates (no cut), while `ads.getAds` and `ads.getLatestAds`
 * trim to a limit — and a trim that ranks section-first is exactly where a
 * regrouped ad could fall off the end.
 */

/** Every ad id a page contains, order-independent. */
const idsOf = (page: { kind: string; ad?: { _id: string } }[]) =>
  new Set(page.filter((e) => e.kind === "ad").map((e) => e.ad!._id));

/**
 * Three ads around the buyer's O'CONNELL row A: one in the same suburb, one
 * ~10 km out (near at 25 km, far at 5 km — the ad the radius actually moves),
 * and one ~200 km out that no clause can reach. Bumped oldest-first in that
 * order, so the 10 km ad is the one a section-first trim would drop when it
 * stops being near.
 */
async function threeAdsAround(t: T, userId: Id<"users">, categoryId: Id<"categories">) {
  // OLDEST, and the only row carrying the buyer's location string — so a
  // date-ordered `.take(2)` cuts it and only the pinned same-suburb pass brings
  // it back, which is what makes the pool (3) exceed the rail's limit (2).
  const sameSuburb = await insertAd(t, {
    userId, categoryId, bumpedAt: T0 + 10,
    localityId: OCONNELL_A.id, latitude: OCONNELL_A.lat, longitude: OCONNELL_A.long,
  });
  // The ad the radius actually moves: near at 15/25/50 km, far at 5/10 km.
  const tenKm = await insertAd(t, {
    userId, categoryId, bumpedAt: T0 + 20,
    location: "SOMEWHERE, QLD 4680", ...NEAR_A_ONLY,
  });
  // NEWEST and always far — the row `tenKm` loses to once it stops being near.
  const twoHundredKm = await insertAd(t, {
    userId, categoryId, bumpedAt: T0 + 40,
    location: "FARAWAY, QLD 4700",
    localityId: 90002, latitude: -25.25, longitude: 151.917285,
  });
  return { tenKm, sameSuburb, twoHundredKm };
}

const BUYER = { location: OCONNELL, locationMeta: locationMetaFromRow(OCONNELL_A) };

describe("the buyer's chosen radius", () => {
  test("a narrower radius regroups the middle ad — it does not remove it", async () => {
    const { t, userId, categoryId } = await fresh();
    const { tenKm } = await threeAdsAround(t, userId, categoryId);

    const at = async (radiusKm: number) =>
      await t.query(api.feed.getFeed, {
        paginationOpts: { numItems: 20, cursor: null },
        ...BUYER, radiusKm, maxSortTime: T0 + 1000,
      });

    const wide = await at(25);
    const narrow = await at(5);

    // The section moved...
    const sectionOf = (r: Awaited<ReturnType<typeof at>>, id: string) =>
      r.page.find((e) => e.kind === "ad" && e.ad._id === id)?.section;
    expect(sectionOf(wide, tenKm)).toBe("near");
    expect(sectionOf(narrow, tenKm)).toBe("far");
    // ...and nothing left the feed.
    expect(idsOf(narrow.page)).toEqual(idsOf(wide.page));
  });

  test("no radius, however narrow, drops an ad from any feed path", async () => {
    const { t, userId, categoryId } = await fresh();
    const { tenKm, sameSuburb, twoHundredKm } = await threeAdsAround(t, userId, categoryId);
    const all = new Set([tenKm, sameSuburb, twoHundredKm]);

    for (const radiusKm of NEAR_RADIUS_OPTIONS_KM) {
      const feed = await t.query(api.feed.getFeed, {
        paginationOpts: { numItems: 20, cursor: null },
        ...BUYER, radiusKm, maxSortTime: T0 + 1000,
      });
      expect(idsOf(feed.page), `getFeed @ ${radiusKm}km`).toEqual(all);

      // `limit: 2` against a pool of 3 ON PURPOSE: it forces the trim to
      // choose, which is the only place a regrouped ad can be lost. The pool
      // exceeds the limit because the same-suburb pinned pass fetches a row the
      // date-ordered pass had already cut — see sectionedAdHits. What must hold
      // is that the SAME two survive at every rung: the cut may not depend on
      // the buyer's distance preference.
      //
      // Before the radius-independent cut, this failed at 5 km — `tenKm` moved
      // to the far group, lost the tie to the newer `twoHundredKm`, and fell
      // off the end of the page. That is the regression this asserts against.
      const rail = await t.query(api.ads.getLatestAds, {
        ...BUYER, radiusKm, sinceTimestamp: T0, limit: 2,
      });
      expect(idsOf(rail), `getLatestAds @ ${radiusKm}km`).toEqual(
        new Set([sameSuburb, tenKm])
      );

      const search = await t.query(api.ads.getAds, {
        ...BUYER, radiusKm, search: "Item",
        paginationOpts: { numItems: 20, cursor: null },
      });
      expect(idsOf(search.page), `getAds @ ${radiusKm}km`).toEqual(all);
    }
  });

  test("an in-area ad is not cut in favour of a newer out-of-area one", async () => {
    const { t, userId, categoryId } = await fresh();
    const { tenKm, twoHundredKm } = await threeAdsAround(t, userId, categoryId);

    // `tenKm` is near by DISTANCE only — a different suburb string, so the
    // pinned same-suburb pass never fetches it, and it is older than the
    // always-far `twoHundredKm`. With room for two of the three, rule 5 says the
    // in-area one goes above the out-of-area one, which means it survives.
    const rail = await t.query(api.ads.getLatestAds, {
      ...BUYER, radiusKm: 25, sinceTimestamp: T0, limit: 2,
    });
    expect(idsOf(rail)).toContain(tenKm);

    // And a card is protected on the same terms an ad is (rules 1 and 4): the
    // far ad is what gets cut, not the nearer listing.
    expect(idsOf(rail)).not.toContain(twoHundredKm);
  });

  test("the buyer's pick beats the admin default; no pick falls back to it", async () => {
    const { t, userId, categoryId } = await fresh();
    const { tenKm } = await threeAdsAround(t, userId, categoryId);
    await t.run(async (ctx) =>
      ctx.db.insert("appSettings", {
        key: SETTING_NEAR_RADIUS_KM, value: 50, description: "admin default",
      })
    );

    const sectionOfTenKm = async (radiusKm?: number) => {
      const r = await t.query(api.feed.getFeed, {
        paginationOpts: { numItems: 20, cursor: null },
        ...BUYER, ...(radiusKm === undefined ? {} : { radiusKm }),
        maxSortTime: T0 + 1000,
      });
      return r.page.find((e) => e.kind === "ad" && e.ad._id === tenKm)?.section;
    };

    // Admin says 50 km, so an unchosen buyer sees the 10 km ad as near.
    expect(await sectionOfTenKm()).toBe("near");
    // The buyer picking 5 km overrides that.
    expect(await sectionOfTenKm(5)).toBe("far");
  });

  test("an out-of-range radius from the client is clamped, not trusted", async () => {
    const { t, userId, categoryId } = await fresh();
    const { twoHundredKm } = await threeAdsAround(t, userId, categoryId);
    const r = await t.query(api.feed.getFeed, {
      paginationOpts: { numItems: 20, cursor: null },
      // 0 is below the setting's minimum of 1 — clamped, not taken literally.
      ...BUYER, radiusKm: 0, maxSortTime: T0 + 1000,
    });
    // Clamped up to the 1 km minimum: the 200 km ad is still far, and still here.
    expect(r.page.find((e) => e.kind === "ad" && e.ad._id === twoHundredKm)?.section).toBe("far");
  });
});
