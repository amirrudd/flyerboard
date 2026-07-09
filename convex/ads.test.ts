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
  opts: { userId: Id<"users">; categoryId: Id<"categories">; title: string; isSold?: boolean }
): Promise<Id<"ads">> {
  return t.run(async (ctx) =>
    ctx.db.insert("ads", {
      title: opts.title,
      description: "desc",
      price: 100,
      location: "Richmond, VIC",
      categoryId: opts.categoryId,
      images: ["r2:flyers/x/1.jpg"],
      userId: opts.userId,
      isActive: true,
      views: 0,
      bumpedAt: Date.now(),
      ...(opts.isSold !== undefined ? { isSold: opts.isSold } : {}),
    })
  );
}

// ──────────────────────────────────────────────────────────────────────────
// getAds — sold ads must not browse as available (bundles/Moving Sale can mark
// a standalone ad isSold: true; the general feed shouldn't mislead buyers).
// ──────────────────────────────────────────────────────────────────────────
describe("getAds excludes sold ads", () => {
  test("non-search: a sold ad is excluded, an available one is included", async () => {
    const t = convexTest(schema, modules);
    const userId = await seedUser(t);
    const categoryId = await seedCategory(t);
    const available = await insertAd(t, { userId, categoryId, title: "Available sofa" });
    const sold = await insertAd(t, { userId, categoryId, title: "Sold table", isSold: true });

    const result = await t.query(api.ads.getAds, {
      paginationOpts: { numItems: 20, cursor: null },
    });
    const ids = result.page.map((a) => a._id);
    expect(ids).toContain(available);
    expect(ids).not.toContain(sold);
  });

  test("search: a sold ad is excluded from search results", async () => {
    const t = convexTest(schema, modules);
    const userId = await seedUser(t);
    const categoryId = await seedCategory(t);
    await insertAd(t, { userId, categoryId, title: "Vintage lamp" });
    const sold = await insertAd(t, { userId, categoryId, title: "Vintage sold lamp", isSold: true });

    const result = await t.query(api.ads.getAds, {
      search: "vintage",
      paginationOpts: { numItems: 20, cursor: null },
    });
    const ids = result.page.map((a) => a._id);
    expect(ids).not.toContain(sold);
  });
});

describe("getLatestAds excludes sold ads", () => {
  test("non-search: a sold ad is excluded from the latest-since feed", async () => {
    const t = convexTest(schema, modules);
    const userId = await seedUser(t);
    const categoryId = await seedCategory(t);
    const since = Date.now() - 60_000;
    const available = await insertAd(t, { userId, categoryId, title: "Fresh chair" });
    const sold = await insertAd(t, { userId, categoryId, title: "Fresh sold chair", isSold: true });

    const ads = await t.query(api.ads.getLatestAds, { sinceTimestamp: since });
    const ids = ads.map((a) => a._id);
    expect(ids).toContain(available);
    expect(ids).not.toContain(sold);
  });

  test("search: a sold ad is excluded from the latest-since search results", async () => {
    const t = convexTest(schema, modules);
    const userId = await seedUser(t);
    const categoryId = await seedCategory(t);
    const since = Date.now() - 60_000;
    await insertAd(t, { userId, categoryId, title: "Antique desk" });
    const sold = await insertAd(t, { userId, categoryId, title: "Antique sold desk", isSold: true });

    const ads = await t.query(api.ads.getLatestAds, { search: "antique", sinceTimestamp: since });
    const ids = ads.map((a) => a._id);
    expect(ids).not.toContain(sold);
  });
});
