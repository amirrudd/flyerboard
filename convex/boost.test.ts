// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

// Load all Convex modules so convex-test can run them (same glob approach as
// saleEvents.test.ts — extglob returns [] under this repo's vitest setup).
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

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

async function seedUser(
  t: ReturnType<typeof convexTest>,
  subject: string,
  name = "Tester"
): Promise<Id<"users">> {
  return t.run(async (ctx) =>
    ctx.db.insert("users", { tokenIdentifier: subject, name, isActive: true })
  );
}

async function seedCategory(t: ReturnType<typeof convexTest>): Promise<Id<"categories">> {
  return t.run(async (ctx) => ctx.db.insert("categories", { name: "Other", slug: "other" }));
}

async function freshWithUser() {
  const t = convexTest(schema, modules);
  const userId = await seedUser(t, "u1", "Amir");
  const categoryId = await seedCategory(t);
  const asUser = t.withIdentity({ subject: "u1" });
  return { t, userId, categoryId, asUser };
}

// ──────────────────────────────────────────────────────────────────────────
// createAd insert site (Phase 1A)
// ──────────────────────────────────────────────────────────────────────────
describe("createAd — bumpedAt seam", () => {
  test("sets bumpedAt (~now) and boostCount 0 on a new ad", async () => {
    const { t, categoryId, asUser } = await freshWithUser();
    const before = Date.now();
    const adId = await asUser.mutation(api.posts.createAd, {
      title: "Couch",
      description: "Comfy",
      listingType: "sale",
      price: 100,
      location: "Richmond, VIC",
      categoryId,
      images: ["r2:flyers/x/img1"],
    });
    const after = Date.now();

    const ad = await t.run((ctx) => ctx.db.get(adId));
    expect(ad).not.toBeNull();
    expect(ad!.boostCount).toBe(0);
    expect(ad!.bumpedAt).toBeGreaterThanOrEqual(before);
    expect(ad!.bumpedAt).toBeLessThanOrEqual(after);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Sale-item insert site (Phase 1A)
// ──────────────────────────────────────────────────────────────────────────
describe("addSaleItems — bumpedAt seam", () => {
  test("sale items are born with bumpedAt (~now) and boostCount 0", async () => {
    const { t, asUser } = await freshWithUser();
    const start = Date.now() + DAY;
    const saleId = await asUser.mutation(api.saleEvents.createSaleEvent, {
      title: "Amir's Moving Sale",
      suburb: "Richmond, VIC",
      pickupWindowStart: start,
      pickupWindowEnd: start + 2 * HOUR,
    });

    const before = Date.now();
    const ids = await asUser.mutation(api.saleEvents.addSaleItems, {
      saleEventId: saleId,
      items: [
        { imageKey: "r2:x/0", title: "Lamp" },
        { imageKey: "r2:x/1", title: "Desk" },
      ],
    });
    const after = Date.now();

    expect(ids).toHaveLength(2);
    for (const id of ids) {
      const ad = await t.run((ctx) => ctx.db.get(id));
      expect(ad!.boostCount).toBe(0);
      expect(ad!.bumpedAt).toBeGreaterThanOrEqual(before);
      expect(ad!.bumpedAt).toBeLessThanOrEqual(after);
    }
  });
});

// ──────────────────────────────────────────────────────────────────────────
// boostAd mutation (Phase 1B)
//
// NOTE (Phase 1B): the Phase 1A `backfillBumpedAt` unit tests were removed here.
// The migration seeded legacy ad rows WITHOUT `bumpedAt` to exercise the backfill,
// but Phase 1B tightens the schema to `bumpedAt: v.number()` (required), so
// convex-test now rejects such inserts at validation — the precondition can no
// longer be constructed. The migration itself remains in convex/migrations.ts for
// the production rollout (deploy 1A → backfill → deploy 1B).
// ──────────────────────────────────────────────────────────────────────────

const DEFAULT_COOLDOWN_MS = 7 * DAY;

/** Turn the boostToTop feature flag on (it ships disabled). */
async function enableBoostFlag(t: ReturnType<typeof convexTest>): Promise<void> {
  await t.run((ctx) =>
    ctx.db.insert("featureFlags", { key: "boostToTop", enabled: true, description: "test" })
  );
}

/** Seed a numeric app setting row. */
async function setSetting(
  t: ReturnType<typeof convexTest>,
  key: string,
  value: number
): Promise<void> {
  await t.run((ctx) => ctx.db.insert("appSettings", { key, value, description: "test" }));
}

/** Create an ad via the public mutation, then age its bumpedAt into the past. */
async function createAgedAd(
  t: ReturnType<typeof convexTest>,
  asUser: ReturnType<ReturnType<typeof convexTest>["withIdentity"]>,
  categoryId: Id<"categories">,
  ageMs: number,
  title = "Couch"
): Promise<Id<"ads">> {
  const adId = await asUser.mutation(api.posts.createAd, {
    title,
    description: "Comfy",
    listingType: "sale",
    price: 100,
    location: "Richmond, VIC",
    categoryId,
    images: ["r2:flyers/x/img1"],
  });
  await t.run((ctx) => ctx.db.patch(adId, { bumpedAt: Date.now() - ageMs }));
  return adId;
}

describe("boostAd — eligibility & flag", () => {
  test("happy path: aged ad is re-stamped to now and boostCount increments", async () => {
    const { t, categoryId, asUser } = await freshWithUser();
    await enableBoostFlag(t);
    const adId = await createAgedAd(t, asUser, categoryId, 8 * DAY);

    const before = Date.now();
    const result = await asUser.mutation(api.posts.boostAd, { adId });
    const after = Date.now();
    expect(result).toBeNull();

    const ad = await t.run((ctx) => ctx.db.get(adId));
    expect(ad!.boostCount).toBe(1);
    expect(ad!.bumpedAt).toBeGreaterThanOrEqual(before);
    expect(ad!.bumpedAt).toBeLessThanOrEqual(after);
  });

  test("rejected when the boostToTop flag is off (fail closed)", async () => {
    const { t, categoryId, asUser } = await freshWithUser();
    // flag NOT enabled
    const adId = await createAgedAd(t, asUser, categoryId, 8 * DAY);
    await expect(asUser.mutation(api.posts.boostAd, { adId })).rejects.toThrow(
      /not available/i
    );
    const ad = await t.run((ctx) => ctx.db.get(adId));
    expect(ad!.boostCount ?? 0).toBe(0);
  });

  test("non-owner cannot boost", async () => {
    const { t, categoryId, asUser } = await freshWithUser();
    await enableBoostFlag(t);
    const adId = await createAgedAd(t, asUser, categoryId, 8 * DAY);

    await seedUser(t, "u2", "Bob");
    const asOther = t.withIdentity({ subject: "u2" });
    await expect(asOther.mutation(api.posts.boostAd, { adId })).rejects.toThrow(
      /your own flyers/i
    );
  });

  test("boostCount increments across successive boosts", async () => {
    const { t, categoryId, asUser } = await freshWithUser();
    await enableBoostFlag(t);
    const adId = await createAgedAd(t, asUser, categoryId, 8 * DAY);

    await asUser.mutation(api.posts.boostAd, { adId });
    // Re-age so the cooldown passes again, then boost a second time.
    await t.run((ctx) => ctx.db.patch(adId, { bumpedAt: Date.now() - 8 * DAY }));
    await asUser.mutation(api.posts.boostAd, { adId });

    const ad = await t.run((ctx) => ctx.db.get(adId));
    expect(ad!.boostCount).toBe(2);
  });
});

describe("boostAd — cooldown", () => {
  test("rejected just under the cooldown, naming the wait", async () => {
    const { t, categoryId, asUser } = await freshWithUser();
    await enableBoostFlag(t);
    // Aged to (cooldown - 1h): still inside the window.
    const adId = await createAgedAd(t, asUser, categoryId, DEFAULT_COOLDOWN_MS - HOUR);
    await expect(asUser.mutation(api.posts.boostAd, { adId })).rejects.toThrow(
      /boost this flyer again in/i
    );
  });

  test("allowed exactly at the cooldown boundary", async () => {
    const { t, categoryId, asUser } = await freshWithUser();
    await enableBoostFlag(t);
    // Aged to exactly the cooldown; by the time the mutation reads Date.now(),
    // elapsed >= cooldown, so it must be allowed.
    const adId = await createAgedAd(t, asUser, categoryId, DEFAULT_COOLDOWN_MS);
    await expect(asUser.mutation(api.posts.boostAd, { adId })).resolves.toBeNull();
  });

  test("reads the configured cooldown (shorter setting → sooner eligibility)", async () => {
    const { t, categoryId, asUser } = await freshWithUser();
    await enableBoostFlag(t);
    await setSetting(t, "boostCooldownDays", 1); // 1 day instead of default 7
    // Aged 2 days: rejected under the default 7d, allowed under the configured 1d.
    const adId = await createAgedAd(t, asUser, categoryId, 2 * DAY);
    await expect(asUser.mutation(api.posts.boostAd, { adId })).resolves.toBeNull();
  });
});

describe("boostAd — state eligibility", () => {
  test("rejects sold, deleted, and inactive ads", async () => {
    const { t, categoryId, asUser } = await freshWithUser();
    await enableBoostFlag(t);

    const sold = await createAgedAd(t, asUser, categoryId, 8 * DAY, "Sold");
    await t.run((ctx) => ctx.db.patch(sold, { isSold: true }));
    await expect(asUser.mutation(api.posts.boostAd, { adId: sold })).rejects.toThrow(/sold/i);

    const deleted = await createAgedAd(t, asUser, categoryId, 8 * DAY, "Deleted");
    await t.run((ctx) => ctx.db.patch(deleted, { isDeleted: true }));
    await expect(asUser.mutation(api.posts.boostAd, { adId: deleted })).rejects.toThrow(/not found/i);

    const inactive = await createAgedAd(t, asUser, categoryId, 8 * DAY, "Inactive");
    await t.run((ctx) => ctx.db.patch(inactive, { isActive: false }));
    await expect(asUser.mutation(api.posts.boostAd, { adId: inactive })).rejects.toThrow(/inactive/i);
  });

  test("rejects bundled ads", async () => {
    const { t, categoryId, asUser } = await freshWithUser();
    await enableBoostFlag(t);

    const bundled = await createAgedAd(t, asUser, categoryId, 8 * DAY, "Bundled");
    const bundleId = await t.run((ctx) =>
      ctx.db.insert("saleBundles", {
        label: "Home office setup",
        bundlePrice: 50,
        adIds: [bundled],
        status: "active",
      })
    );
    await t.run((ctx) => ctx.db.patch(bundled, { bundleId }));
    await expect(asUser.mutation(api.posts.boostAd, { adId: bundled })).rejects.toThrow(/bundled/i);
  });

  test("rejects sale-event member ads", async () => {
    const { t, userId, categoryId, asUser } = await freshWithUser();
    await enableBoostFlag(t);

    const saleAd = await createAgedAd(t, asUser, categoryId, 8 * DAY, "Sale item");
    const saleId = await t.run((ctx) =>
      ctx.db.insert("saleEvents", {
        userId,
        title: "Amir's Moving Sale",
        suburb: "Richmond, VIC",
        pickupWindowStart: Date.now(),
        pickupWindowEnd: Date.now() + HOUR,
        status: "active",
        createdAt: Date.now(),
      })
    );
    await t.run((ctx) => ctx.db.patch(saleAd, { saleEventId: saleId }));
    await expect(asUser.mutation(api.posts.boostAd, { adId: saleAd })).rejects.toThrow(/sale/i);
  });
});

describe("boostAd — daily cap", () => {
  test("(cap)th boost allowed, (cap+1)th rejected; reads configured cap", async () => {
    const { t, categoryId, asUser } = await freshWithUser();
    await enableBoostFlag(t);
    await setSetting(t, "boostDailyCap", 2); // cap = 2

    const a = await createAgedAd(t, asUser, categoryId, 8 * DAY, "A");
    const b = await createAgedAd(t, asUser, categoryId, 8 * DAY, "B");
    const c = await createAgedAd(t, asUser, categoryId, 8 * DAY, "C");

    await expect(asUser.mutation(api.posts.boostAd, { adId: a })).resolves.toBeNull(); // 1
    await expect(asUser.mutation(api.posts.boostAd, { adId: b })).resolves.toBeNull(); // 2 (cap)
    await expect(asUser.mutation(api.posts.boostAd, { adId: c })).rejects.toThrow(/rate limit/i); // 3

    // The rejected boost consumed no budget: c was not bumped.
    const adC = await t.run((ctx) => ctx.db.get(c));
    expect(adC!.boostCount ?? 0).toBe(0);
  });

  test("default cap (3) applies when no setting is present", async () => {
    const { t, categoryId, asUser } = await freshWithUser();
    await enableBoostFlag(t);
    const ads: Id<"ads">[] = [];
    for (let i = 0; i < 4; i++) {
      ads.push(await createAgedAd(t, asUser, categoryId, 8 * DAY, `Ad ${i}`));
    }
    await expect(asUser.mutation(api.posts.boostAd, { adId: ads[0] })).resolves.toBeNull();
    await expect(asUser.mutation(api.posts.boostAd, { adId: ads[1] })).resolves.toBeNull();
    await expect(asUser.mutation(api.posts.boostAd, { adId: ads[2] })).resolves.toBeNull();
    await expect(asUser.mutation(api.posts.boostAd, { adId: ads[3] })).rejects.toThrow(/rate limit/i);
  });
});

describe("feed ordering by bumpedAt (Phase 1B)", () => {
  test("the feed surfaces a boosted ad first", async () => {
    const { t, categoryId, asUser } = await freshWithUser();
    await enableBoostFlag(t);

    const older = await createAgedAd(t, asUser, categoryId, 10 * DAY, "Older");
    const newer = await createAgedAd(t, asUser, categoryId, 1 * DAY, "Newer");

    const adIds = (page: Array<{ ad: { _id: string } } | { card: { _id: string } }>) =>
      page.flatMap((e) => ("ad" in e ? [e.ad._id] : []));

    // Before boosting: newer (bumpedAt = now-1d) leads older (now-10d).
    const before = await asUser.query(api.feed.getFeed, {
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(adIds(before.page)[0]).toBe(newer);

    // Boost the older ad → its bumpedAt jumps to now, above newer.
    await asUser.mutation(api.posts.boostAd, { adId: older });

    const after = await asUser.query(api.feed.getFeed, {
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(adIds(after.page)[0]).toBe(older);
  });

  test("getLatestAds returns a boosted ad for a since-watermark below its new bumpedAt", async () => {
    const { t, categoryId, asUser } = await freshWithUser();
    await enableBoostFlag(t);

    const adId = await createAgedAd(t, asUser, categoryId, 10 * DAY, "Aged");
    const since = Date.now() - 5 * DAY;

    // Before boosting: bumpedAt (now-10d) is below the watermark → not returned.
    const before = await asUser.query(api.ads.getLatestAds, { sinceTimestamp: since });
    expect(before.find((a) => a._id === adId)).toBeUndefined();

    // Boost → bumpedAt jumps to now (> since) → now returned.
    await asUser.mutation(api.posts.boostAd, { adId });
    const after = await asUser.query(api.ads.getLatestAds, { sinceTimestamp: since });
    expect(after.find((a) => a._id === adId)).toBeDefined();
  });
});
