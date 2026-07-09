// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

// Load all Convex modules (functions, helpers) so convex-test can run them.
// Note: the extglob pattern `!(*.*.*)` returns [] under this repo's vite/vitest
// setup, so we glob .ts + .js explicitly and drop .d.ts + test files below.
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

/** Insert a user and return their _id + their Descope subject (tokenIdentifier). */
async function seedUser(
  t: ReturnType<typeof convexTest>,
  subject: string,
  name = "Tester"
): Promise<Id<"users">> {
  return t.run(async (ctx) =>
    ctx.db.insert("users", {
      tokenIdentifier: subject,
      name,
      isActive: true,
    })
  );
}

/** Insert at least one category (required by addSaleItems → getDefaultCategoryId). */
async function seedCategory(
  t: ReturnType<typeof convexTest>
): Promise<Id<"categories">> {
  return t.run(async (ctx) =>
    ctx.db.insert("categories", { name: "Other", slug: "other" })
  );
}

/** Fresh harness with a primary user "u1" (subject), one category, returns handles. */
async function freshWithUser() {
  const t = convexTest(schema, modules);
  const userId = await seedUser(t, "u1", "Amir");
  const categoryId = await seedCategory(t);
  const asUser = t.withIdentity({ subject: "u1" });
  return { t, userId, categoryId, asUser };
}

/** Create a draft sale owned by asUser with a valid pickup window. */
async function createDraft(
  asUser: ReturnType<ReturnType<typeof convexTest>["withIdentity"]>,
  overrides: Partial<{
    title: string;
    suburb: string;
    pickupWindowStart: number;
    pickupWindowEnd: number;
  }> = {}
): Promise<Id<"saleEvents">> {
  const start = overrides.pickupWindowStart ?? Date.now() + DAY;
  const end = overrides.pickupWindowEnd ?? start + 2 * HOUR;
  return asUser.mutation(api.saleEvents.createSaleEvent, {
    title: overrides.title ?? "Amir's Moving Sale",
    suburb: overrides.suburb ?? "Richmond, VIC",
    pickupWindowStart: start,
    pickupWindowEnd: end,
  });
}

// ──────────────────────────────────────────────────────────────────────────
// createSaleEvent
// ──────────────────────────────────────────────────────────────────────────
describe("createSaleEvent", () => {
  test("throws when unauthenticated", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.mutation(api.saleEvents.createSaleEvent, {
        title: "Sale",
        suburb: "Richmond, VIC",
        pickupWindowStart: Date.now(),
        pickupWindowEnd: Date.now() + HOUR,
      })
    ).rejects.toThrow(/logged in/i);
  });

  test("creates a draft when authed", async () => {
    const { t, asUser } = await freshWithUser();
    const saleId = await createDraft(asUser);
    const sale = await t.run((ctx) => ctx.db.get(saleId));
    expect(sale).not.toBeNull();
    expect(sale!.status).toBe("draft");
    expect(sale!.slug).toBeUndefined();
  });

  test("rejects pickupWindowEnd <= start", async () => {
    const { asUser } = await freshWithUser();
    const now = Date.now();
    await expect(
      asUser.mutation(api.saleEvents.createSaleEvent, {
        title: "Sale",
        suburb: "Richmond, VIC",
        pickupWindowStart: now + HOUR,
        pickupWindowEnd: now + HOUR, // equal → invalid
      })
    ).rejects.toThrow(/after the start/i);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// updateSaleEvent — owner only
// ──────────────────────────────────────────────────────────────────────────
describe("updateSaleEvent", () => {
  test("owner can update title", async () => {
    const { t, asUser } = await freshWithUser();
    const saleId = await createDraft(asUser);
    await asUser.mutation(api.saleEvents.updateSaleEvent, {
      saleEventId: saleId,
      title: "New Title",
    });
    const sale = await t.run((ctx) => ctx.db.get(saleId));
    expect(sale!.title).toBe("New Title");
  });

  test("a different user cannot modify the sale", async () => {
    const { t, asUser } = await freshWithUser();
    const saleId = await createDraft(asUser);
    await seedUser(t, "u2", "Intruder");
    const asOther = t.withIdentity({ subject: "u2" });
    await expect(
      asOther.mutation(api.saleEvents.updateSaleEvent, {
        saleEventId: saleId,
        title: "Hijacked",
      })
    ).rejects.toThrow(/your own sale/i);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// addSaleItems
// ──────────────────────────────────────────────────────────────────────────
describe("addSaleItems", () => {
  test("creates draft ads with sale defaults", async () => {
    const { t, asUser } = await freshWithUser();
    const saleId = await createDraft(asUser);
    const ids = await asUser.mutation(api.saleEvents.addSaleItems, {
      saleEventId: saleId,
      items: [
        { imageKey: "r2:flyers/x/a.jpg", title: "Chair", price: 20 },
        { imageKey: "r2:flyers/x/b.jpg" },
      ],
    });
    expect(ids).toHaveLength(2);
    const ads = await t.run((ctx) =>
      Promise.all(ids.map((id: Id<"ads">) => ctx.db.get(id)))
    );
    for (const ad of ads) {
      expect(ad!.isActive).toBe(false);
      expect(ad!.isSold).toBe(false);
      expect(ad!.saleEventId).toBe(saleId);
      expect(ad!.listingType).toBe("sale");
      expect(ad!.categoryId).toBeDefined();
    }
    expect(ads[0]!.title).toBe("Chair");
  });

  test("non-owner cannot add items", async () => {
    const { t, asUser } = await freshWithUser();
    const saleId = await createDraft(asUser);
    await seedUser(t, "u2");
    const asOther = t.withIdentity({ subject: "u2" });
    await expect(
      asOther.mutation(api.saleEvents.addSaleItems, {
        saleEventId: saleId,
        items: [{ imageKey: "r2:x" }],
      })
    ).rejects.toThrow(/your own sale/i);
  });

  test("enforces the 100-item abuse ceiling", async () => {
    const { asUser } = await freshWithUser();
    const saleId = await createDraft(asUser);
    const items = Array.from({ length: 101 }, (_, i) => ({
      imageKey: `r2:flyers/x/${i}.jpg`,
    }));
    await expect(
      asUser.mutation(api.saleEvents.addSaleItems, {
        saleEventId: saleId,
        items,
      })
    ).rejects.toThrow(/up to 100 items/i);
  });

  test("uses an explicit category when given", async () => {
    const { t, asUser, categoryId } = await freshWithUser();
    const otherCat = await t.run((ctx) =>
      ctx.db.insert("categories", { name: "Furniture", slug: "furniture" })
    );
    const saleId = await createDraft(asUser);
    const [adId] = await asUser.mutation(api.saleEvents.addSaleItems, {
      saleEventId: saleId,
      items: [{ imageKey: "r2:x", categoryId: otherCat }],
    });
    const ad = await t.run((ctx) => ctx.db.get(adId));
    expect(ad!.categoryId).toBe(otherCat);
    expect(ad!.categoryId).not.toBe(categoryId);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// updateSaleItem / removeSaleItem / setItemSold — owner only
// ──────────────────────────────────────────────────────────────────────────
describe("item mutations ownership + semantics", () => {
  async function seedSaleWithItem() {
    const ctx = await freshWithUser();
    const saleId = await createDraft(ctx.asUser);
    const [adId] = await ctx.asUser.mutation(api.saleEvents.addSaleItems, {
      saleEventId: saleId,
      items: [{ imageKey: "r2:x", title: "Lamp", price: 15 }],
    });
    return { ...ctx, saleId, adId };
  }

  test("owner can update an item", async () => {
    const { t, asUser, adId } = await seedSaleWithItem();
    await asUser.mutation(api.saleEvents.updateSaleItem, {
      adId,
      price: 99,
      condition: "Good",
    });
    const ad = await t.run((ctx) => ctx.db.get(adId));
    expect(ad!.price).toBe(99);
    expect(ad!.condition).toBe("Good");
  });

  test("non-owner cannot update an item", async () => {
    const { t, adId } = await seedSaleWithItem();
    await seedUser(t, "u2");
    const asOther = t.withIdentity({ subject: "u2" });
    await expect(
      asOther.mutation(api.saleEvents.updateSaleItem, { adId, price: 1 })
    ).rejects.toThrow(/your own items/i);
  });

  test("setItemSold flips isSold but NOT isDeleted", async () => {
    const { t, asUser, adId } = await seedSaleWithItem();
    await asUser.mutation(api.saleEvents.setItemSold, { adId, isSold: true });
    const ad = await t.run((ctx) => ctx.db.get(adId));
    expect(ad!.isSold).toBe(true);
    expect(ad!.isDeleted).not.toBe(true);
  });

  test("non-owner cannot mark sold", async () => {
    const { t, adId } = await seedSaleWithItem();
    await seedUser(t, "u2");
    const asOther = t.withIdentity({ subject: "u2" });
    await expect(
      asOther.mutation(api.saleEvents.setItemSold, { adId, isSold: true })
    ).rejects.toThrow(/your own items/i);
  });

  test("removeSaleItem soft-deletes (isDeleted)", async () => {
    const { t, asUser, adId } = await seedSaleWithItem();
    await asUser.mutation(api.saleEvents.removeSaleItem, { adId });
    const ad = await t.run((ctx) => ctx.db.get(adId));
    expect(ad!.isDeleted).toBe(true);
    expect(ad!.isActive).toBe(false);
  });

  test("non-owner cannot remove an item", async () => {
    const { t, adId } = await seedSaleWithItem();
    await seedUser(t, "u2");
    const asOther = t.withIdentity({ subject: "u2" });
    await expect(
      asOther.mutation(api.saleEvents.removeSaleItem, { adId })
    ).rejects.toThrow(/your own items/i);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// setBundles
// ──────────────────────────────────────────────────────────────────────────
describe("setBundles", () => {
  async function seedSaleWithItems(n: number) {
    const ctx = await freshWithUser();
    const saleId = await createDraft(ctx.asUser);
    const ids = await ctx.asUser.mutation(api.saleEvents.addSaleItems, {
      saleEventId: saleId,
      items: Array.from({ length: n }, (_, i) => ({
        imageKey: `r2:x/${i}`,
        title: `Item ${i}`,
      })),
    });
    return { ...ctx, saleId, ids: ids };
  }

  test("non-owner cannot set bundles", async () => {
    const { t, saleId, ids } = await seedSaleWithItems(2);
    await seedUser(t, "u2");
    const asOther = t.withIdentity({ subject: "u2" });
    await expect(
      asOther.mutation(api.saleEvents.setBundles, {
        saleEventId: saleId,
        bundles: [{ label: "B", bundlePrice: 10, adIds: ids }],
      })
    ).rejects.toThrow(/your own sale/i);
  });

  test("a bundle needs >= 2 items (singletons skipped)", async () => {
    const { asUser, saleId, ids } = await seedSaleWithItems(2);
    const created = await asUser.mutation(api.saleEvents.setBundles, {
      saleEventId: saleId,
      bundles: [{ label: "Solo", bundlePrice: 5, adIds: [ids[0]] }],
    });
    expect(created).toHaveLength(0);
  });

  test("stamps bundleId on member ads and only accepts ads in this sale", async () => {
    const { t, asUser, saleId, ids } = await seedSaleWithItems(2);
    // A foreign ad belonging to no sale.
    const foreignAd = await t.run(async (ctx) =>
      ctx.db.insert("ads", {
        title: "Foreign",
        description: "",
        location: "X",
        categoryId: (await ctx.db.query("categories").first())!._id,
        images: ["r2:f"],
        userId: (await ctx.db.query("users").first())!._id,
        isActive: true,
        views: 0,
        bumpedAt: Date.now(),
      })
    );
    const created = await asUser.mutation(api.saleEvents.setBundles, {
      saleEventId: saleId,
      bundles: [
        { label: "Combo", bundlePrice: 30, adIds: [ids[0], ids[1], foreignAd] },
      ],
    });
    expect(created).toHaveLength(1);
    const bundle = await t.run((ctx) => ctx.db.get(created[0]));
    // Foreign ad filtered out → only the two sale items remain.
    expect(bundle!.adIds).toHaveLength(2);
    expect(bundle!.adIds).not.toContain(foreignAd);

    const ad0 = await t.run((ctx) => ctx.db.get(ids[0]));
    expect(ad0!.bundleId).toBe(created[0]);
  });

  test("replacing bundles clears old ones and their bundleId stamps", async () => {
    const { t, asUser, saleId, ids } = await seedSaleWithItems(2);
    const first = await asUser.mutation(api.saleEvents.setBundles, {
      saleEventId: saleId,
      bundles: [{ label: "Old", bundlePrice: 10, adIds: ids }],
    });
    expect(first).toHaveLength(1);

    // Replace with empty set → clears.
    const second = await asUser.mutation(api.saleEvents.setBundles, {
      saleEventId: saleId,
      bundles: [],
    });
    expect(second).toHaveLength(0);

    const remaining = await t.run((ctx) =>
      ctx.db
        .query("saleBundles")
        .withIndex("by_sale_event", (q) => q.eq("saleEventId", saleId))
        .collect()
    );
    expect(remaining).toHaveLength(0);

    const ad0 = await t.run((ctx) => ctx.db.get(ids[0]));
    expect(ad0!.bundleId).toBeUndefined();
  });
});

// ──────────────────────────────────────────────────────────────────────────
// publishSaleEvent — FREE, no payment gate
// ──────────────────────────────────────────────────────────────────────────
describe("publishSaleEvent (free)", () => {
  test("non-owner cannot publish", async () => {
    const { t, asUser } = await freshWithUser();
    const saleId = await createDraft(asUser);
    await seedUser(t, "u2");
    const asOther = t.withIdentity({ subject: "u2" });
    await expect(
      asOther.mutation(api.saleEvents.publishSaleEvent, { saleEventId: saleId })
    ).rejects.toThrow(/your own sale/i);
  });

  test("owner publishes: mints slug, sets active, activates items, no payment", async () => {
    const { t, asUser } = await freshWithUser();
    const saleId = await createDraft(asUser);
    const ids = await asUser.mutation(api.saleEvents.addSaleItems, {
      saleEventId: saleId,
      items: [{ imageKey: "r2:x", title: "Desk", price: 50 }],
    });

    const { slug } = await asUser.mutation(api.saleEvents.publishSaleEvent, {
      saleEventId: saleId,
    });
    expect(typeof slug).toBe("string");
    expect(slug.length).toBeGreaterThan(0);

    const sale = await t.run((ctx) => ctx.db.get(saleId));
    expect(sale!.status).toBe("active");
    expect(sale!.isPaid).not.toBe(true); // free — never set
    expect(sale!.expiresAt).toBeGreaterThan(sale!.pickupWindowEnd);

    const ad = await t.run((ctx) => ctx.db.get((ids)[0]));
    expect(ad!.isActive).toBe(true);

    // Retrievable on the public page without any payment.
    const page = await t.query(api.saleEvents.getSaleBySlug, { slug });
    expect(page).not.toBeNull();
    expect(page!.sale.status).toBe("active");
  });
});

// ──────────────────────────────────────────────────────────────────────────
// purchaseAddon (stub)
// ──────────────────────────────────────────────────────────────────────────
describe("purchaseAddon", () => {
  test("owner adds addon to unlockedAddons", async () => {
    const { t, asUser } = await freshWithUser();
    const saleId = await createDraft(asUser);
    const res = await asUser.mutation(api.saleEvents.purchaseAddon, {
      saleEventId: saleId,
      addon: "flyer",
    });
    expect(res.unlockedAddons).toContain("flyer");
    const sale = await t.run((ctx) => ctx.db.get(saleId));
    expect(sale!.unlockedAddons).toContain("flyer");
  });

  test("pin addon sets pinnedUntil in the future", async () => {
    const { t, asUser } = await freshWithUser();
    const saleId = await createDraft(asUser);
    await asUser.mutation(api.saleEvents.purchaseAddon, {
      saleEventId: saleId,
      addon: "pin",
    });
    const sale = await t.run((ctx) => ctx.db.get(saleId));
    expect(sale!.pinnedUntil).toBeGreaterThan(Date.now());
  });

  test("non-owner cannot purchase addon", async () => {
    const { t, asUser } = await freshWithUser();
    const saleId = await createDraft(asUser);
    await seedUser(t, "u2");
    const asOther = t.withIdentity({ subject: "u2" });
    await expect(
      asOther.mutation(api.saleEvents.purchaseAddon, {
        saleEventId: saleId,
        addon: "pin",
      })
    ).rejects.toThrow(/your own sale/i);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// getMySaleEvents
// ──────────────────────────────────────────────────────────────────────────
describe("getMySaleEvents", () => {
  test("returns [] when unauthenticated", async () => {
    const t = convexTest(schema, modules);
    const res = await t.query(api.saleEvents.getMySaleEvents, {});
    expect(res).toEqual([]);
  });

  test("returns caller's events with stats", async () => {
    const { t, asUser } = await freshWithUser();
    const saleId = await createDraft(asUser);
    const ids = await asUser.mutation(api.saleEvents.addSaleItems, {
      saleEventId: saleId,
      items: [
        { imageKey: "r2:a", price: 20 },
        { imageKey: "r2:b", price: 30 },
      ],
    });
    await asUser.mutation(api.saleEvents.setItemSold, {
      adId: (ids)[0],
      isSold: true,
    });

    const res = await asUser.query(api.saleEvents.getMySaleEvents, {});
    expect(res).toHaveLength(1);
    expect(res[0].itemCount).toBe(2);
    expect(res[0].soldCount).toBe(1);
    expect(res[0].availableCount).toBe(1);
    expect(res[0].totalValue).toBe(50);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// getSaleEditor — owner-only, no leak
// ──────────────────────────────────────────────────────────────────────────
describe("getSaleEditor", () => {
  test("returns null for a non-owner (no leak)", async () => {
    const { t, asUser } = await freshWithUser();
    const saleId = await createDraft(asUser);
    await seedUser(t, "u2");
    const asOther = t.withIdentity({ subject: "u2" });
    const res = await asOther.query(api.saleEvents.getSaleEditor, {
      saleEventId: saleId,
    });
    expect(res).toBeNull();
  });

  test("returns {sale, items, bundles} for the owner", async () => {
    const { asUser } = await freshWithUser();
    const saleId = await createDraft(asUser);
    await asUser.mutation(api.saleEvents.addSaleItems, {
      saleEventId: saleId,
      items: [{ imageKey: "r2:a" }],
    });
    const res = await asUser.query(api.saleEvents.getSaleEditor, {
      saleEventId: saleId,
    });
    expect(res).not.toBeNull();
    expect(res!.sale._id).toBe(saleId);
    expect(res!.items).toHaveLength(1);
    expect(res!.bundles).toEqual([]);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// getSaleBySlug — PUBLIC free gate
// ──────────────────────────────────────────────────────────────────────────
describe("getSaleBySlug (public free gate)", () => {
  test("returns null for an unknown slug", async () => {
    const t = convexTest(schema, modules);
    const res = await t.query(api.saleEvents.getSaleBySlug, {
      slug: "does-not-exist",
    });
    expect(res).toBeNull();
  });

  test("returns null for a draft sale (not yet published)", async () => {
    const { t, asUser } = await freshWithUser();
    const saleId = await createDraft(asUser);
    // Manually give the draft a slug to prove the gate is on status, not slug.
    await t.run((ctx) => ctx.db.patch(saleId, { slug: "draft-slug" }));
    const res = await t.query(api.saleEvents.getSaleBySlug, {
      slug: "draft-slug",
    });
    expect(res).toBeNull();
  });

  test("returns the sale once active WITHOUT any payment (isPaid unset)", async () => {
    const { t, asUser } = await freshWithUser();
    const saleId = await createDraft(asUser);
    await asUser.mutation(api.saleEvents.addSaleItems, {
      saleEventId: saleId,
      items: [{ imageKey: "r2:a", price: 10 }],
    });
    const { slug } = await asUser.mutation(api.saleEvents.publishSaleEvent, {
      saleEventId: saleId,
    });

    const sale = await t.run((ctx) => ctx.db.get(saleId));
    expect(sale!.isPaid).not.toBe(true); // proves paywall removal

    const res = await t.query(api.saleEvents.getSaleBySlug, { slug });
    expect(res).not.toBeNull();
    expect(res!.sale.status).toBe("active");
    expect(res!.items).toHaveLength(1);
    expect(res!.stats.total).toBe(1);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// getSaleBannerForAd
// ──────────────────────────────────────────────────────────────────────────
describe("getSaleBannerForAd", () => {
  test("returns null for an ad that is not part of a sale", async () => {
    const { t, userId, categoryId } = await freshWithUser();
    const adId = await t.run((ctx) =>
      ctx.db.insert("ads", {
        title: "Plain",
        description: "",
        location: "Z",
        categoryId,
        images: ["r2:p"],
        userId,
        isActive: true,
        views: 0,
        bumpedAt: Date.now(),
      })
    );
    expect(
      await t.query(api.saleEvents.getSaleBannerForAd, { adId })
    ).toBeNull();
  });

  test("returns banner data: title-cased name, min price, thumbnail strip", async () => {
    const { t, asUser } = await freshWithUser();
    const saleId = await createDraft(asUser, {
      title: "Amir's Moving Sale",
      suburb: "Richmond, VIC",
    });
    const ids = await asUser.mutation(api.saleEvents.addSaleItems, {
      saleEventId: saleId,
      items: [
        { imageKey: "r2:0", price: 50 },
        { imageKey: "r2:1", price: 20 },
        { imageKey: "r2:2", price: 30 },
        { imageKey: "r2:3", price: 40 },
        { imageKey: "r2:4", price: 60 },
      ],
    });
    await asUser.mutation(api.saleEvents.publishSaleEvent, {
      saleEventId: saleId,
    });

    const banner = await t.query(api.saleEvents.getSaleBannerForAd, {
      adId: ids[0],
    });
    expect(banner).not.toBeNull();
    expect(banner!.sellerFirstName).toBe("Amir"); // title-cased first name
    expect(banner!.suburb).toBe("Richmond, VIC");
    expect(banner!.itemCount).toBe(5);
    expect(banner!.minPrice).toBe(20);
    expect(banner!.currentImage).toBe("r2:0");
    expect(banner!.currentItemSold).toBe(false);
    // Current item excluded; 3 of the 4 others shown, 1 remaining.
    expect(banner!.otherImages).toHaveLength(3);
    expect(banner!.otherImages).not.toContain("r2:0");
    expect(banner!.moreCount).toBe(1);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// getActiveSales
// ──────────────────────────────────────────────────────────────────────────
describe("getActiveSales", () => {
  test("returns only active (published) sales, drafts excluded", async () => {
    const { t, asUser } = await freshWithUser();

    // A draft (must be excluded).
    await createDraft(asUser);

    // Published sale A (not pinned).
    const saleA = await createDraft(asUser, { title: "Sale A" });
    await asUser.mutation(api.saleEvents.addSaleItems, {
      saleEventId: saleA,
      items: [{ imageKey: "r2:a", price: 5 }],
    });
    await asUser.mutation(api.saleEvents.publishSaleEvent, {
      saleEventId: saleA,
    });

    // Published sale B (pinned via addon).
    const saleB = await createDraft(asUser, { title: "Sale B" });
    await asUser.mutation(api.saleEvents.addSaleItems, {
      saleEventId: saleB,
      items: [{ imageKey: "r2:b", price: 8 }],
    });
    await asUser.mutation(api.saleEvents.publishSaleEvent, {
      saleEventId: saleB,
    });
    await asUser.mutation(api.saleEvents.purchaseAddon, {
      saleEventId: saleB,
      addon: "pin",
    });

    const res = await t.query(api.saleEvents.getActiveSales, {});
    expect(res).toHaveLength(2); // draft excluded
    // v3: only active sales returned (newest-first by creation date; assert
    // membership rather than exact order since both are created in the same ms).
    const titles = res.map((s) => s.title);
    expect(titles).toContain("Sale A");
    expect(titles).toContain("Sale B");
  });
});
