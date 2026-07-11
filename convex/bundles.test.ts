// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

// Load all Convex modules so convex-test can run them (same loader as saleEvents.test.ts).
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

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────

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

/** Insert a standalone ad directly (bypasses createAd rate limits / validation). */
async function insertAd(
  t: ReturnType<typeof convexTest>,
  opts: {
    userId: Id<"users">;
    categoryId: Id<"categories">;
    title?: string;
    price?: number;
    images?: string[];
    isSold?: boolean;
    location?: string;
    saleEventId?: Id<"saleEvents">;
    bundleId?: Id<"saleBundles">;
    listingType?: "sale" | "exchange" | "both";
  }
): Promise<Id<"ads">> {
  return t.run(async (ctx) =>
    ctx.db.insert("ads", {
      title: opts.title ?? "Item",
      description: "desc",
      price: opts.price ?? 100,
      ...(opts.listingType ? { listingType: opts.listingType } : {}),
      location: opts.location ?? "Richmond, VIC",
      categoryId: opts.categoryId,
      images: opts.images ?? ["r2:flyers/x/1.jpg"],
      userId: opts.userId,
      isActive: true,
      views: 0,
      bumpedAt: Date.now(),
      ...(opts.isSold !== undefined ? { isSold: opts.isSold } : {}),
      ...(opts.saleEventId ? { saleEventId: opts.saleEventId } : {}),
      ...(opts.bundleId ? { bundleId: opts.bundleId } : {}),
    })
  );
}

async function fresh() {
  const t = convexTest(schema, modules);
  const userId = await seedUser(t, "u1", "Amir");
  const categoryId = await seedCategory(t);
  const asUser = t.withIdentity({ subject: "u1" });
  return { t, userId, categoryId, asUser };
}

// ──────────────────────────────────────────────────────────────────────────
// createBundle
// ──────────────────────────────────────────────────────────────────────────
describe("createBundle", () => {
  test("throws when unauthenticated", async () => {
    const { t, userId, categoryId } = await fresh();
    const a = await insertAd(t, { userId, categoryId });
    const b = await insertAd(t, { userId, categoryId });
    await expect(
      t.mutation(api.bundles.createBundle, { adIds: [a, b], bundlePrice: 150 })
    ).rejects.toThrow(/logged in/i);
  });

  test("creates an active standalone bundle and stamps bundleId on each ad", async () => {
    const { t, userId, categoryId, asUser } = await fresh();
    const a = await insertAd(t, { userId, categoryId, title: "Sofa", price: 350 });
    const b = await insertAd(t, { userId, categoryId, title: "Table", price: 280 });

    const bundleId = await asUser.mutation(api.bundles.createBundle, {
      adIds: [a, b],
      bundlePrice: 530,
    });

    const bundle = await t.run((ctx) => ctx.db.get(bundleId));
    expect(bundle).not.toBeNull();
    expect(bundle!.status).toBe("active");
    expect(bundle!.sellerId).toBe(userId);
    expect(bundle!.saleEventId).toBeUndefined();
    expect(bundle!.adIds).toEqual([a, b]);
    expect(bundle!.label).toBe("Sofa + Table"); // auto-generated

    const adA = await t.run((ctx) => ctx.db.get(a));
    const adB = await t.run((ctx) => ctx.db.get(b));
    expect(adA!.bundleId).toBe(bundleId);
    expect(adB!.bundleId).toBe(bundleId);
  });

  test("rejects fewer than 2 items", async () => {
    const { t, userId, categoryId, asUser } = await fresh();
    const a = await insertAd(t, { userId, categoryId });
    await expect(
      asUser.mutation(api.bundles.createBundle, { adIds: [a], bundlePrice: 50 })
    ).rejects.toThrow(/between 2 and 4/i);
  });

  test("rejects more than 4 items", async () => {
    const { t, userId, categoryId, asUser } = await fresh();
    const ids = [];
    for (let i = 0; i < 5; i++) ids.push(await insertAd(t, { userId, categoryId }));
    await expect(
      asUser.mutation(api.bundles.createBundle, { adIds: ids, bundlePrice: 50 })
    ).rejects.toThrow(/between 2 and 4/i);
  });

  test("de-dupes repeated ids (so [a,a] is treated as 1 item → rejected)", async () => {
    const { t, userId, categoryId, asUser } = await fresh();
    const a = await insertAd(t, { userId, categoryId });
    await expect(
      asUser.mutation(api.bundles.createBundle, { adIds: [a, a], bundlePrice: 50 })
    ).rejects.toThrow(/between 2 and 4/i);
  });

  test("rejects a non-positive bundle price", async () => {
    const { t, userId, categoryId, asUser } = await fresh();
    const a = await insertAd(t, { userId, categoryId });
    const b = await insertAd(t, { userId, categoryId });
    await expect(
      asUser.mutation(api.bundles.createBundle, { adIds: [a, b], bundlePrice: 0 })
    ).rejects.toThrow(/greater than zero/i);
  });

  test("rejects an ad the caller does not own", async () => {
    const { t, userId, categoryId, asUser } = await fresh();
    const other = await seedUser(t, "u2", "Someone");
    const a = await insertAd(t, { userId, categoryId });
    const b = await insertAd(t, { userId: other, categoryId });
    await expect(
      asUser.mutation(api.bundles.createBundle, { adIds: [a, b], bundlePrice: 50 })
    ).rejects.toThrow(/your own/i);
  });

  test("rejects an ad already in another bundle", async () => {
    const { t, userId, categoryId, asUser } = await fresh();
    const a = await insertAd(t, { userId, categoryId });
    const b = await insertAd(t, { userId, categoryId });
    await asUser.mutation(api.bundles.createBundle, { adIds: [a, b], bundlePrice: 50 });
    const c = await insertAd(t, { userId, categoryId });
    await expect(
      asUser.mutation(api.bundles.createBundle, { adIds: [a, c], bundlePrice: 60 })
    ).rejects.toThrow(/already in another bundle/i);
  });

  test("rejects an ad that is part of a moving sale (mutual exclusivity)", async () => {
    const { t, userId, categoryId, asUser } = await fresh();
    const saleEventId = await t.run((ctx) =>
      ctx.db.insert("saleEvents", {
        userId,
        title: "Sale",
        suburb: "Richmond, VIC",
        pickupWindowStart: Date.now(),
        pickupWindowEnd: Date.now() + 3600_000,
        status: "active",
        createdAt: Date.now(),
      })
    );
    const a = await insertAd(t, { userId, categoryId, saleEventId });
    const b = await insertAd(t, { userId, categoryId });
    await expect(
      asUser.mutation(api.bundles.createBundle, { adIds: [a, b], bundlePrice: 50 })
    ).rejects.toThrow(/moving sale/i);
  });

  test("rejects a sold ad", async () => {
    const { t, userId, categoryId, asUser } = await fresh();
    const a = await insertAd(t, { userId, categoryId, isSold: true });
    const b = await insertAd(t, { userId, categoryId });
    await expect(
      asUser.mutation(api.bundles.createBundle, { adIds: [a, b], bundlePrice: 50 })
    ).rejects.toThrow(/sold/i);
  });

  test("uses a provided label over the auto-generated one", async () => {
    const { t, userId, categoryId, asUser } = await fresh();
    const a = await insertAd(t, { userId, categoryId });
    const b = await insertAd(t, { userId, categoryId });
    const bundleId = await asUser.mutation(api.bundles.createBundle, {
      adIds: [a, b],
      bundlePrice: 50,
      label: "Living room set",
    });
    const bundle = await t.run((ctx) => ctx.db.get(bundleId));
    expect(bundle!.label).toBe("Living room set");
  });
});

// ──────────────────────────────────────────────────────────────────────────
// updateBundlePrice / removeBundleItem / cancelBundle
// ──────────────────────────────────────────────────────────────────────────
describe("updateBundlePrice", () => {
  test("owner updates the price", async () => {
    const { t, userId, categoryId, asUser } = await fresh();
    const a = await insertAd(t, { userId, categoryId });
    const b = await insertAd(t, { userId, categoryId });
    const bundleId = await asUser.mutation(api.bundles.createBundle, { adIds: [a, b], bundlePrice: 100 });
    await asUser.mutation(api.bundles.updateBundlePrice, { bundleId, bundlePrice: 90 });
    const bundle = await t.run((ctx) => ctx.db.get(bundleId));
    expect(bundle!.bundlePrice).toBe(90);
  });

  test("non-owner cannot update", async () => {
    const { t, userId, categoryId, asUser } = await fresh();
    const a = await insertAd(t, { userId, categoryId });
    const b = await insertAd(t, { userId, categoryId });
    const bundleId = await asUser.mutation(api.bundles.createBundle, { adIds: [a, b], bundlePrice: 100 });
    await seedUser(t, "u2");
    const asOther = t.withIdentity({ subject: "u2" });
    await expect(
      asOther.mutation(api.bundles.updateBundlePrice, { bundleId, bundlePrice: 1 })
    ).rejects.toThrow(/your own/i);
  });
});

describe("removeBundleItem", () => {
  test("removing from a 3-item bundle keeps it active with the remaining two", async () => {
    const { t, userId, categoryId, asUser } = await fresh();
    const a = await insertAd(t, { userId, categoryId });
    const b = await insertAd(t, { userId, categoryId });
    const c = await insertAd(t, { userId, categoryId });
    const bundleId = await asUser.mutation(api.bundles.createBundle, { adIds: [a, b, c], bundlePrice: 100 });
    const res = await asUser.mutation(api.bundles.removeBundleItem, { bundleId, adId: c });
    expect(res.status).toBe("active");
    const bundle = await t.run((ctx) => ctx.db.get(bundleId));
    expect(bundle!.adIds).toEqual([a, b]);
    const adC = await t.run((ctx) => ctx.db.get(c));
    expect(adC!.bundleId).toBeUndefined();
  });

  test("removing until below minimum cancels the bundle and frees all ads", async () => {
    const { t, userId, categoryId, asUser } = await fresh();
    const a = await insertAd(t, { userId, categoryId });
    const b = await insertAd(t, { userId, categoryId });
    const bundleId = await asUser.mutation(api.bundles.createBundle, { adIds: [a, b], bundlePrice: 100 });
    const res = await asUser.mutation(api.bundles.removeBundleItem, { bundleId, adId: b });
    expect(res.status).toBe("cancelled");
    const bundle = await t.run((ctx) => ctx.db.get(bundleId));
    expect(bundle!.status).toBe("cancelled");
    const adA = await t.run((ctx) => ctx.db.get(a));
    const adB = await t.run((ctx) => ctx.db.get(b));
    expect(adA!.bundleId).toBeUndefined();
    expect(adB!.bundleId).toBeUndefined();
  });
});

describe("cancelBundle", () => {
  test("reverts every item to standalone", async () => {
    const { t, userId, categoryId, asUser } = await fresh();
    const a = await insertAd(t, { userId, categoryId });
    const b = await insertAd(t, { userId, categoryId });
    const bundleId = await asUser.mutation(api.bundles.createBundle, { adIds: [a, b], bundlePrice: 100 });
    await asUser.mutation(api.bundles.cancelBundle, { bundleId });
    const bundle = await t.run((ctx) => ctx.db.get(bundleId));
    expect(bundle!.status).toBe("cancelled");
    for (const id of [a, b]) {
      const ad = await t.run((ctx) => ctx.db.get(id));
      expect(ad!.bundleId).toBeUndefined();
    }
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Sold-state machine
// ──────────────────────────────────────────────────────────────────────────
describe("markBundleSold", () => {
  test("marks all items sold atomically and flips status to sold", async () => {
    const { t, userId, categoryId, asUser } = await fresh();
    const a = await insertAd(t, { userId, categoryId });
    const b = await insertAd(t, { userId, categoryId });
    const bundleId = await asUser.mutation(api.bundles.createBundle, { adIds: [a, b], bundlePrice: 100 });
    await asUser.mutation(api.bundles.markBundleSold, { bundleId });
    const bundle = await t.run((ctx) => ctx.db.get(bundleId));
    expect(bundle!.status).toBe("sold");
    for (const id of [a, b]) {
      const ad = await t.run((ctx) => ctx.db.get(id));
      expect(ad!.isSold).toBe(true);
    }
  });

  test("throws (no half-apply) when an item already sold individually", async () => {
    const { t, userId, categoryId, asUser } = await fresh();
    const a = await insertAd(t, { userId, categoryId });
    const b = await insertAd(t, { userId, categoryId });
    const c = await insertAd(t, { userId, categoryId });
    const bundleId = await asUser.mutation(api.bundles.createBundle, { adIds: [a, b, c], bundlePrice: 100 });
    // b sells individually → bundle becomes partial → markBundleSold rejected.
    await asUser.mutation(api.bundles.markBundleItemSold, { adId: b });
    await expect(
      asUser.mutation(api.bundles.markBundleSold, { bundleId })
    ).rejects.toThrow(/active/i);
    // a and c must remain unsold.
    const adA = await t.run((ctx) => ctx.db.get(a));
    const adC = await t.run((ctx) => ctx.db.get(c));
    expect(adA!.isSold).toBeFalsy();
    expect(adC!.isSold).toBeFalsy();
  });
});

describe("markBundleItemSold", () => {
  test("moves the bundle to partial and marks the item sold", async () => {
    const { t, userId, categoryId, asUser } = await fresh();
    const a = await insertAd(t, { userId, categoryId });
    const b = await insertAd(t, { userId, categoryId });
    const bundleId = await asUser.mutation(api.bundles.createBundle, { adIds: [a, b], bundlePrice: 100 });
    await asUser.mutation(api.bundles.markBundleItemSold, { adId: a });
    const bundle = await t.run((ctx) => ctx.db.get(bundleId));
    expect(bundle!.status).toBe("partial");
    const adA = await t.run((ctx) => ctx.db.get(a));
    expect(adA!.isSold).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// detach-on-delete (posts.deleteAd integration)
// ──────────────────────────────────────────────────────────────────────────
describe("deleteAd detaches from bundle", () => {
  test("deleting a member of a 3-item bundle → partial + item detached", async () => {
    const { t, userId, categoryId, asUser } = await fresh();
    const a = await insertAd(t, { userId, categoryId });
    const b = await insertAd(t, { userId, categoryId });
    const c = await insertAd(t, { userId, categoryId });
    const bundleId = await asUser.mutation(api.bundles.createBundle, { adIds: [a, b, c], bundlePrice: 100 });
    await asUser.mutation(api.posts.deleteAd, { adId: c });
    const bundle = await t.run((ctx) => ctx.db.get(bundleId));
    expect(bundle!.status).toBe("partial");
    expect(bundle!.adIds).toEqual([a, b]);
  });

  test("deleting a member of a 2-item bundle → cancelled + survivor freed", async () => {
    const { t, userId, categoryId, asUser } = await fresh();
    const a = await insertAd(t, { userId, categoryId });
    const b = await insertAd(t, { userId, categoryId });
    const bundleId = await asUser.mutation(api.bundles.createBundle, { adIds: [a, b], bundlePrice: 100 });
    await asUser.mutation(api.posts.deleteAd, { adId: a });
    const bundle = await t.run((ctx) => ctx.db.get(bundleId));
    expect(bundle!.status).toBe("cancelled");
    const adB = await t.run((ctx) => ctx.db.get(b));
    expect(adB!.bundleId).toBeUndefined();
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Queries
// ──────────────────────────────────────────────────────────────────────────
describe("getBundleBannerForAd", () => {
  test("returns the deal with the current item first and correct savings", async () => {
    const { t, userId, categoryId, asUser } = await fresh();
    const a = await insertAd(t, { userId, categoryId, title: "Sofa", price: 350 });
    const b = await insertAd(t, { userId, categoryId, title: "Table", price: 280 });
    await asUser.mutation(api.bundles.createBundle, { adIds: [a, b], bundlePrice: 530 });

    const banner = await t.query(api.bundles.getBundleBannerForAd, { adId: b });
    expect(banner).not.toBeNull();
    expect(banner!.bundlePrice).toBe(530);
    expect(banner!.separatelyTotal).toBe(630);
    expect(banner!.savings).toBe(100);
    expect(banner!.items[0].isCurrent).toBe(true);
    expect(banner!.items[0].adId).toBe(b);
    expect(banner!.items).toHaveLength(2);
  });

  test("returns null once the bundle is partial", async () => {
    const { t, userId, categoryId, asUser } = await fresh();
    const a = await insertAd(t, { userId, categoryId });
    const b = await insertAd(t, { userId, categoryId });
    await asUser.mutation(api.bundles.createBundle, { adIds: [a, b], bundlePrice: 50 });
    await asUser.mutation(api.bundles.markBundleItemSold, { adId: a });
    expect(await t.query(api.bundles.getBundleBannerForAd, { adId: b })).toBeNull();
  });

  test("returns null for an ad with no bundle", async () => {
    const { t, userId, categoryId } = await fresh();
    const a = await insertAd(t, { userId, categoryId });
    expect(await t.query(api.bundles.getBundleBannerForAd, { adId: a })).toBeNull();
  });
});

describe("getActiveBundleFeedCards", () => {
  test("returns active standalone bundles with covers + adIds, newest first", async () => {
    const { t, userId, categoryId, asUser } = await fresh();
    const a = await insertAd(t, { userId, categoryId, price: 350, images: ["r2:a.jpg"] });
    const b = await insertAd(t, { userId, categoryId, price: 280, images: ["r2:b.jpg"] });
    await asUser.mutation(api.bundles.createBundle, { adIds: [a, b], bundlePrice: 530 });

    const cards = await t.query(api.bundles.getActiveBundleFeedCards, {});
    expect(cards).toHaveLength(1);
    expect(cards[0].itemCount).toBe(2);
    expect(cards[0].savings).toBe(100);
    expect(cards[0].covers).toEqual(["r2:a.jpg", "r2:b.jpg"]);
    expect(cards[0].adIds).toEqual([a, b]);
  });

  test("excludes partial/sold bundles and Sale-scoped bundles", async () => {
    const { t, userId, categoryId, asUser } = await fresh();
    // Partial standalone bundle.
    const a = await insertAd(t, { userId, categoryId });
    const b = await insertAd(t, { userId, categoryId });
    await asUser.mutation(api.bundles.createBundle, { adIds: [a, b], bundlePrice: 50 });
    await asUser.mutation(api.bundles.markBundleItemSold, { adId: a });
    // Sale-scoped bundle (should never appear in the standalone feed).
    const saleEventId = await t.run((ctx) =>
      ctx.db.insert("saleEvents", {
        userId,
        title: "Sale",
        suburb: "Richmond, VIC",
        pickupWindowStart: Date.now(),
        pickupWindowEnd: Date.now() + 3600_000,
        status: "active",
        createdAt: Date.now(),
      })
    );
    await t.run((ctx) =>
      ctx.db.insert("saleBundles", {
        saleEventId,
        sellerId: userId,
        status: "active",
        label: "Sale bundle",
        bundlePrice: 20,
        adIds: [],
      })
    );
    const cards = await t.query(api.bundles.getActiveBundleFeedCards, {});
    expect(cards).toHaveLength(0);
  });
});

describe("getEligibleAdsForBundle", () => {
  test("flags eligibility and reasons", async () => {
    const { t, userId, categoryId, asUser } = await fresh();
    const free1 = await insertAd(t, { userId, categoryId, title: "Free1" });
    const free2 = await insertAd(t, { userId, categoryId, title: "Free2" });
    const sold = await insertAd(t, { userId, categoryId, title: "Sold", isSold: true });
    // one already in a bundle
    const g1 = await insertAd(t, { userId, categoryId });
    const g2 = await insertAd(t, { userId, categoryId });
    await asUser.mutation(api.bundles.createBundle, { adIds: [g1, g2], bundlePrice: 50 });

    const list = await asUser.query(api.bundles.getEligibleAdsForBundle, {});
    const byId = new Map(list.map((x) => [x._id, x]));
    expect(byId.get(free1)!.eligible).toBe(true);
    expect(byId.get(free2)!.eligible).toBe(true);
    expect(byId.get(sold)!.eligible).toBe(false);
    expect(byId.get(sold)!.reason).toMatch(/sold/i);
    expect(byId.get(g1)!.eligible).toBe(false);
    expect(byId.get(g1)!.reason).toMatch(/another bundle/i);
  });
});

describe("getMyBundles", () => {
  test("returns the owner's active bundles with resolved items", async () => {
    const { t, userId, categoryId, asUser } = await fresh();
    const a = await insertAd(t, { userId, categoryId, title: "Sofa", price: 350 });
    const b = await insertAd(t, { userId, categoryId, title: "Table", price: 280 });
    const bundleId = await asUser.mutation(api.bundles.createBundle, { adIds: [a, b], bundlePrice: 530, label: "Living room" });

    const mine = await asUser.query(api.bundles.getMyBundles, {});
    expect(mine).toHaveLength(1);
    expect(mine[0]._id).toBe(bundleId);
    expect(mine[0].label).toBe("Living room");
    expect(mine[0].savings).toBe(100);
    expect(mine[0].items).toHaveLength(2);
  });

  test("excludes cancelled bundles", async () => {
    const { t, userId, categoryId, asUser } = await fresh();
    const a = await insertAd(t, { userId, categoryId });
    const b = await insertAd(t, { userId, categoryId });
    const bundleId = await asUser.mutation(api.bundles.createBundle, { adIds: [a, b], bundlePrice: 50 });
    await asUser.mutation(api.bundles.cancelBundle, { bundleId });
    expect(await asUser.query(api.bundles.getMyBundles, {})).toHaveLength(0);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Mutual exclusivity with Moving Sale — exercised through the REAL sale-creation
// flow (createSaleEvent → addSaleItems), locking the invariant from both sides.
// ──────────────────────────────────────────────────────────────────────────
describe("mutual exclusivity with Moving Sale", () => {
  const DAY = 24 * 60 * 60 * 1000;

  async function addRealSaleItem(
    asUser: ReturnType<ReturnType<typeof convexTest>["withIdentity"]>
  ): Promise<Id<"ads">> {
    const start = Date.now() + DAY;
    const saleEventId = await asUser.mutation(api.saleEvents.createSaleEvent, {
      title: "Amir's Moving Sale",
      suburb: "Richmond, VIC",
      pickupWindowStart: start,
      pickupWindowEnd: start + 2 * 60 * 60 * 1000,
    });
    const [adId] = await asUser.mutation(api.saleEvents.addSaleItems, {
      saleEventId,
      items: [{ imageKey: "r2:flyers/x/1.jpg", title: "Desk", price: 200 }],
    });
    return adId;
  }

  test("a sale item is created with saleEventId and NO bundleId", async () => {
    const { t, asUser } = await fresh();
    const saleAd = await addRealSaleItem(asUser);
    const ad = await t.run((ctx) => ctx.db.get(saleAd));
    expect(ad!.saleEventId).toBeTruthy();
    expect(ad!.bundleId).toBeUndefined();
  });

  test("the bundle picker marks a sale item ineligible with the sale reason", async () => {
    const { asUser } = await fresh();
    const saleAd = await addRealSaleItem(asUser);
    const list = await asUser.query(api.bundles.getEligibleAdsForBundle, {});
    const entry = list.find((x) => x._id === saleAd);
    expect(entry).toBeDefined();
    expect(entry!.eligible).toBe(false);
    expect(entry!.reason).toMatch(/moving sale/i);
  });

  test("createBundle rejects a real sale item", async () => {
    const { t, categoryId, userId, asUser } = await fresh();
    const saleAd = await addRealSaleItem(asUser);
    const standalone = await insertAd(t, { userId, categoryId });
    await expect(
      asUser.mutation(api.bundles.createBundle, { adIds: [saleAd, standalone], bundlePrice: 100 })
    ).rejects.toThrow(/moving sale/i);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Exchange guard (bundle v2) — bundles are sale-only
// ──────────────────────────────────────────────────────────────────────────
describe("exchange guard", () => {
  test("createBundle rejects a trade-only (exchange) ad", async () => {
    const { t, userId, categoryId, asUser } = await fresh();
    const sale = await insertAd(t, { userId, categoryId, title: "Sofa", price: 350 });
    const trade = await insertAd(t, { userId, categoryId, title: "Swap chair", listingType: "exchange" });
    await expect(
      asUser.mutation(api.bundles.createBundle, { adIds: [sale, trade], bundlePrice: 300 })
    ).rejects.toThrow(/trade-only/i);
  });

  test("both-type ads (sale + trade) remain bundleable", async () => {
    const { t, userId, categoryId, asUser } = await fresh();
    const a = await insertAd(t, { userId, categoryId, listingType: "both", price: 100 });
    const b = await insertAd(t, { userId, categoryId, listingType: "sale", price: 100 });
    const bundleId = await asUser.mutation(api.bundles.createBundle, { adIds: [a, b], bundlePrice: 150 });
    expect(bundleId).toBeDefined();
  });

  test("getEligibleAdsForBundle flags exchange ads as Trade-only", async () => {
    const { t, userId, categoryId, asUser } = await fresh();
    const trade = await insertAd(t, { userId, categoryId, listingType: "exchange" });
    const list = await asUser.query(api.bundles.getEligibleAdsForBundle, {});
    const row = list.find((x) => x._id === trade)!;
    expect(row.eligible).toBe(false);
    expect(row.reason).toMatch(/trade/i);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// getPublicBundle — the /bundle/:id "Deal Ticket" payload
// ──────────────────────────────────────────────────────────────────────────
describe("getPublicBundle", () => {
  test("returns the full payload without auth (public page)", async () => {
    const { t, userId, categoryId, asUser } = await fresh();
    const a = await insertAd(t, { userId, categoryId, title: "Sofa", price: 350 });
    const b = await insertAd(t, { userId, categoryId, title: "Table", price: 280 });
    const bundleId = await asUser.mutation(api.bundles.createBundle, {
      adIds: [a, b],
      bundlePrice: 530,
    });

    // Anonymous viewer — no identity at all.
    const payload = await t.query(api.bundles.getPublicBundle, { bundleId });
    expect(payload).not.toBeNull();
    expect(payload!.status).toBe("active");
    expect(payload!.bundlePrice).toBe(530);
    expect(payload!.separatelyTotal).toBe(630);
    expect(payload!.savings).toBe(100);
    expect(payload!.savingsPct).toBe(16);
    expect(payload!.isOwner).toBe(false);
    expect(payload!.seller?.name).toBe("Amir");
    expect(payload!.items.map((i) => i.title)).toEqual(["Sofa", "Table"]);
  });

  test("isOwner is true for the seller", async () => {
    const { t, userId, categoryId, asUser } = await fresh();
    const a = await insertAd(t, { userId, categoryId });
    const b = await insertAd(t, { userId, categoryId });
    const bundleId = await asUser.mutation(api.bundles.createBundle, { adIds: [a, b], bundlePrice: 150 });
    const payload = await asUser.query(api.bundles.getPublicBundle, { bundleId });
    expect(payload!.isOwner).toBe(true);
  });

  test("partial bundle still resolves with the sold member flagged", async () => {
    const { t, userId, categoryId, asUser } = await fresh();
    const a = await insertAd(t, { userId, categoryId, title: "Sofa", price: 350 });
    const b = await insertAd(t, { userId, categoryId, title: "Table", price: 280 });
    const bundleId = await asUser.mutation(api.bundles.createBundle, { adIds: [a, b], bundlePrice: 530 });
    await asUser.mutation(api.bundles.markBundleItemSold, { adId: b });

    const payload = await t.query(api.bundles.getPublicBundle, { bundleId });
    expect(payload).not.toBeNull();
    expect(payload!.status).toBe("partial");
    const soldItem = payload!.items.find((i) => i.title === "Table")!;
    expect(soldItem.isSold).toBe(true);
  });

  test("returns null for cancelled bundles and Sale-scoped bundles", async () => {
    const { t, userId, categoryId, asUser } = await fresh();
    const a = await insertAd(t, { userId, categoryId });
    const b = await insertAd(t, { userId, categoryId });
    const bundleId = await asUser.mutation(api.bundles.createBundle, { adIds: [a, b], bundlePrice: 150 });
    await asUser.mutation(api.bundles.cancelBundle, { bundleId });
    expect(await t.query(api.bundles.getPublicBundle, { bundleId })).toBeNull();

    const saleEventId = await t.run((ctx) =>
      ctx.db.insert("saleEvents", {
        userId,
        title: "Sale",
        suburb: "Coogee",
        status: "active",
        slug: "sale-1",
        pickupWindowStart: Date.now(),
        pickupWindowEnd: Date.now() + 3600_000,
        createdAt: Date.now(),
      })
    );
    const saleBundleId = await t.run((ctx) =>
      ctx.db.insert("saleBundles", {
        saleEventId,
        label: "Sale bundle",
        bundlePrice: 50,
        adIds: [a, b],
      })
    );
    expect(await t.query(api.bundles.getPublicBundle, { bundleId: saleBundleId })).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Saved bundles — mirrors savedSaleEvents
// ──────────────────────────────────────────────────────────────────────────
describe("saved bundles", () => {
  async function freshWithBundle() {
    const base = await fresh();
    const a = await insertAd(base.t, { userId: base.userId, categoryId: base.categoryId, title: "Sofa", price: 350 });
    const b = await insertAd(base.t, { userId: base.userId, categoryId: base.categoryId, title: "Table", price: 280 });
    const bundleId = await base.asUser.mutation(api.bundles.createBundle, {
      adIds: [a, b],
      bundlePrice: 530,
    });
    await seedUser(base.t, "u2", "Buyer");
    const asBuyer = base.t.withIdentity({ subject: "u2" });
    return { ...base, bundleId, asBuyer };
  }

  test("saveBundle requires auth", async () => {
    const { t, bundleId } = await freshWithBundle();
    await expect(t.mutation(api.bundles.saveBundle, { bundleId })).rejects.toThrow(/logged in/i);
  });

  test("toggles save / unsave and isBundleSaved tracks it", async () => {
    const { bundleId, asBuyer } = await freshWithBundle();

    expect(await asBuyer.query(api.bundles.isBundleSaved, { bundleId })).toBe(false);
    expect(await asBuyer.mutation(api.bundles.saveBundle, { bundleId })).toEqual({ saved: true });
    expect(await asBuyer.query(api.bundles.isBundleSaved, { bundleId })).toBe(true);
    expect(await asBuyer.mutation(api.bundles.saveBundle, { bundleId })).toEqual({ saved: false });
    expect(await asBuyer.query(api.bundles.isBundleSaved, { bundleId })).toBe(false);
  });

  test("getSavedBundles returns the dashboard payload", async () => {
    const { bundleId, asBuyer } = await freshWithBundle();
    await asBuyer.mutation(api.bundles.saveBundle, { bundleId });

    const saved = await asBuyer.query(api.bundles.getSavedBundles, {});
    expect(saved).toHaveLength(1);
    expect(saved[0].bundle._id).toBe(bundleId);
    expect(saved[0].bundle.label).toBe("Sofa + Table");
    expect(saved[0].bundle.status).toBe("active");
    expect(saved[0].bundle.bundlePrice).toBe(530);
    expect(saved[0].bundle.itemCount).toBe(2);
  });

  test("a cancelled bundle drops out of the saved list", async () => {
    const { asUser, bundleId, asBuyer } = await freshWithBundle();
    await asBuyer.mutation(api.bundles.saveBundle, { bundleId });
    await asUser.mutation(api.bundles.cancelBundle, { bundleId });
    expect(await asBuyer.query(api.bundles.getSavedBundles, {})).toEqual([]);
  });
});
