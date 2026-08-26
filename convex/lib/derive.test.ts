// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import schema from "../schema";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import {
  adIsVisible,
  autoLabel,
  deriveFromMembers,
  hydrateBundleItems,
  saleItems,
} from "./derive";

/**
 * THE REFRESH CONTRACT.
 *
 * A Bundle / Moving Sale denormalises `categoryIds`, `searchText` and `location`
 * off its member ads (rule 1). That only stays true if EVERY mutation that writes
 * to the `ads` table re-derives the composites the ad belongs to afterwards.
 *
 * Four mutations shipped without doing that. Discipline already failed once, so
 * this file does not rely on it:
 *
 *   1. `MUTATIONS` must list every exported mutation in every top-level
 *      `convex/*.ts` module whose source mentions the ads table (see
 *      `EXPORTED_MUTATIONS` for the scan and its exclusions). Add a mutation —
 *      or write `"ads"` from a new module — and this test fails until you
 *      classify it.
 *   2. Every entry flagged `writesAds` must have an `exercise`, and after
 *      running it EVERY composite in the database must equal a fresh derivation
 *      over its current members. Forget the refresh, this test fails.
 */

const modules = loadConvexModules();
function loadConvexModules(): Record<string, () => Promise<unknown>> {
  const all = {
    ...import.meta.glob("../**/*.ts"),
    ...import.meta.glob("../**/*.js"),
  } as Record<string, () => Promise<unknown>>;
  const filtered: Record<string, () => Promise<unknown>> = {};
  for (const [key, loader] of Object.entries(all)) {
    if (key.endsWith(".d.ts")) continue;
    if (/\.(test|spec)\.[cm]?[jt]sx?$/.test(key)) continue;
    filtered[key] = loader;
  }
  return filtered;
}

/**
 * Every "module.mutation" exported by a top-level convex module whose source
 * mentions the ads table, scraped from raw source. `../*.ts` deliberately does
 * not descend into `../_generated/` or `../lib/` (no mutations live there —
 * helpers and tests only); test files at the top level export no mutations, so
 * they scrape to nothing. Modules that never say `"ads"` structurally cannot
 * write the table and need no classification — a later ads write necessarily
 * introduces the string and pulls the module into the required set.
 * `sampleData.ts` is excluded by name: dev-only, hard-wipes the ads table
 * wholesale, and its env guard throws under convex-test. Do not copy it.
 */
const EXPORTED_MUTATIONS = Object.entries(
  import.meta.glob("../*.ts", { query: "?raw", import: "default", eager: true })
)
  .filter(([path, source]) => path !== "../sampleData.ts" && source.includes('"ads"'))
  .flatMap(([path, source]) =>
    [...source.matchAll(/^export const (\w+) = (?:internalM|m)utation\(/gm)].map(
      (m) => `${path.replace(/^\.\.\//, "").replace(/\.ts$/, "")}.${m[1]}`
    )
  )
  .sort();

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

type World = Awaited<ReturnType<typeof world>>;
type Case = {
  /** true = the handler writes to the `ads` table (insert, patch or delete). */
  writesAds: boolean;
  exercise?: (w: World) => Promise<unknown>;
};

// ──────────────────────────────────────────────────────────────────────────
// Fixture
// ──────────────────────────────────────────────────────────────────────────

/**
 * A world with one of everything a composite can be made of: a standalone bundle
 * of two ads, three loose ads, a PUBLISHED moving sale of two items, and a draft
 * sale for `publishSaleEvent` to publish.
 */
async function world() {
  // convexTest leaves transaction limits DISABLED by default, which would let a
  // read-amplification regression (e.g. per-ad composite refresh — O(N²)) pass
  // every test here. Cap documentsRead well above what once-per-composite
  // implementations need (~350 for the bulk fixture) and well below what
  // per-ad refresh costs (~4,000): the regression now fails.
  const t = convexTest({ schema, modules, transactionLimits: { documentsRead: 1000 } });

  const sellerId = await t.run((ctx) =>
    ctx.db.insert("users", {
      tokenIdentifier: "seller",
      name: "Amir",
      email: "seller@example.com",
      isActive: true,
    })
  );
  await t.run((ctx) =>
    ctx.db.insert("users", {
      tokenIdentifier: "admin",
      name: "Admin",
      isActive: true,
      isAdmin: true,
    })
  );
  const categoryId = await t.run((ctx) =>
    ctx.db.insert("categories", { name: "Other", slug: "other" })
  );
  const tools = await t.run((ctx) =>
    ctx.db.insert("categories", { name: "Tools", slug: "tools" })
  );
  const asUser = t.withIdentity({ subject: "seller" });
  const asAdmin = t.withIdentity({ subject: "admin" });

  const loose = async (title: string) =>
    t.run((ctx) =>
      ctx.db.insert("ads", {
        title,
        description: "desc",
        listingType: "sale" as const,
        price: 100,
        location: "Richmond, VIC",
        categoryId,
        images: ["r2:a", "r2:b"],
        userId: sellerId,
        isActive: true,
        isSold: false,
        views: 0,
        bumpedAt: Date.now() - 30 * DAY, // old enough to clear the Boost cooldown
        boostCount: 0,
      })
    );

  const [a1, a2, a3, a4, a5] = await Promise.all(
    ["Oak desk", "Office chair", "Floor lamp", "Bookcase", "Bike"].map(loose)
  );
  const bundleId = await asUser.mutation(api.bundles.createBundle, {
    adIds: [a1, a2],
    bundlePrice: 150,
  });

  const start = Date.now() + DAY;
  const saleEventId = await asUser.mutation(api.saleEvents.createSaleEvent, {
    title: "Amir's Moving Sale",
    suburb: "Richmond, VIC",
    pickupWindowStart: start,
    pickupWindowEnd: start + 2 * HOUR,
  });
  const [s1, s2] = await asUser.mutation(api.saleEvents.addSaleItems, {
    saleEventId,
    items: [
      { imageKey: "r2:s1", title: "Teak sideboard" },
      { imageKey: "r2:s2", title: "Rug", categoryId: tools },
    ],
  });
  await asUser.mutation(api.saleEvents.publishSaleEvent, { saleEventId });

  const draftSaleId = await asUser.mutation(api.saleEvents.createSaleEvent, {
    title: "Second sale",
    suburb: "Fitzroy, VIC",
    pickupWindowStart: start,
    pickupWindowEnd: start + 2 * HOUR,
  });
  await asUser.mutation(api.saleEvents.addSaleItems, {
    saleEventId: draftSaleId,
    items: [{ imageKey: "r2:d1", title: "Kettle" }],
  });

  await t.run((ctx) =>
    ctx.db.insert("featureFlags", { key: "boostToTop", enabled: true, description: "test" })
  );

  return {
    t,
    asUser,
    asAdmin,
    sellerId,
    categoryId,
    tools,
    a1,
    a2,
    a3,
    a4,
    a5,
    bundleId,
    saleEventId,
    draftSaleId,
    s1,
    s2,
  };
}

/**
 * Every composite in the database must hold exactly what a fresh derivation over
 * its CURRENT members produces. This is the contract; nothing else in this file
 * asserts anything about a specific mutation's behaviour.
 */
async function expectAllCompositesDerived(t: World["t"], label: string) {
  await t.run(async (ctx) => {
    for (const bundle of await ctx.db.query("saleBundles").collect()) {
      if (bundle.saleEventId) {
        // Sale-suggestion bundles are deliberately not derived (never feed, never
        // search) — they must stay out of the `search_composite` index.
        expect(bundle.searchText, `${label}: sale bundle ${bundle._id} indexed`).toBeUndefined();
        continue;
      }
      const members = (await hydrateBundleItems(ctx, bundle.adIds)).filter(adIsVisible);
      const expectedLabel =
        bundle.labelIsAuto === true ? autoLabel(members.map((m) => m.title)) : bundle.label;
      expect(
        {
          categoryIds: bundle.categoryIds,
          searchText: bundle.searchText,
          locations: bundle.locations,
          label: bundle.label,
        },
        `${label}: bundle ${bundle._id} is stale`
      ).toEqual({ ...deriveFromMembers(members, expectedLabel), label: expectedLabel });
    }

    for (const sale of await ctx.db.query("saleEvents").collect()) {
      const members = (await saleItems(ctx, sale._id)).filter(adIsVisible);
      expect(
        {
          categoryIds: sale.categoryIds,
          searchText: sale.searchText,
          locations: sale.locations,
        },
        `${label}: sale ${sale._id} is stale`
      ).toEqual(deriveFromMembers(members, sale.title));
    }
  });
}

// ──────────────────────────────────────────────────────────────────────────
// The registry
// ──────────────────────────────────────────────────────────────────────────

const MUTATIONS: Record<string, Record<string, Case>> = {
  posts: {
    createAd: {
      writesAds: true,
      exercise: (w) =>
        w.asUser.mutation(api.posts.createAd, {
          title: "New couch",
          description: "Comfy",
          listingType: "sale",
          price: 100,
          location: "Richmond, VIC",
          categoryId: w.categoryId,
          images: ["r2:new"],
        }),
    },
    updateAd: {
      writesAds: true,
      exercise: (w) =>
        w.asUser.mutation(api.posts.updateAd, {
          adId: w.a1,
          title: "Teak bureau",
          description: "desc",
          listingType: "sale",
          price: 90,
          location: "Fitzroy, VIC", // location is derived too — the old guard missed it
          categoryId: w.tools,
          images: ["r2:a"],
        }),
    },
    boostAd: { writesAds: true, exercise: (w) => w.asUser.mutation(api.posts.boostAd, { adId: w.a5 }) },
    deleteAd: { writesAds: true, exercise: (w) => w.asUser.mutation(api.posts.deleteAd, { adId: w.a1 }) },
    toggleAdStatus: {
      writesAds: true,
      exercise: (w) => w.asUser.mutation(api.posts.toggleAdStatus, { adId: w.a1 }),
    },
  },

  bundles: {
    createBundle: {
      writesAds: true,
      exercise: (w) =>
        w.asUser.mutation(api.bundles.createBundle, { adIds: [w.a3, w.a4], bundlePrice: 120 }),
    },
    updateBundlePrice: {
      writesAds: false,
      exercise: (w) =>
        w.asUser.mutation(api.bundles.updateBundlePrice, {
          bundleId: w.bundleId,
          bundlePrice: 99,
        }),
    },
    removeBundleItem: {
      writesAds: true,
      exercise: (w) =>
        w.asUser.mutation(api.bundles.removeBundleItem, { bundleId: w.bundleId, adId: w.a1 }),
    },
    cancelBundle: {
      writesAds: true,
      exercise: (w) => w.asUser.mutation(api.bundles.cancelBundle, { bundleId: w.bundleId }),
    },
    markBundleSold: {
      writesAds: true,
      exercise: (w) => w.asUser.mutation(api.bundles.markBundleSold, { bundleId: w.bundleId }),
    },
    markBundleItemSold: {
      writesAds: true,
      exercise: (w) => w.asUser.mutation(api.bundles.markBundleItemSold, { adId: w.a1 }),
    },
    saveBundle: { writesAds: false },
  },

  saleEvents: {
    createSaleEvent: { writesAds: false },
    updateSaleEvent: {
      writesAds: false,
      exercise: (w) =>
        w.asUser.mutation(api.saleEvents.updateSaleEvent, {
          saleEventId: w.saleEventId,
          title: "Renamed sale",
        }),
    },
    addSaleItems: {
      writesAds: true,
      exercise: (w) =>
        w.asUser.mutation(api.saleEvents.addSaleItems, {
          saleEventId: w.saleEventId,
          items: [{ imageKey: "r2:s3", title: "Toaster" }],
        }),
    },
    updateSaleItem: {
      writesAds: true,
      exercise: (w) =>
        w.asUser.mutation(api.saleEvents.updateSaleItem, {
          adId: w.s1,
          title: "Walnut sideboard",
          categoryId: w.tools,
        }),
    },
    removeSaleItem: {
      writesAds: true,
      exercise: (w) => w.asUser.mutation(api.saleEvents.removeSaleItem, { adId: w.s1 }),
    },
    setItemSold: {
      writesAds: true,
      exercise: (w) => w.asUser.mutation(api.saleEvents.setItemSold, { adId: w.s1, isSold: true }),
    },
    setBundles: {
      writesAds: true,
      exercise: (w) =>
        w.asUser.mutation(api.saleEvents.setBundles, {
          saleEventId: w.saleEventId,
          bundles: [{ label: "Sideboard + rug", bundlePrice: 60, adIds: [w.s1, w.s2] }],
        }),
    },
    publishSaleEvent: {
      writesAds: true,
      exercise: (w) =>
        w.asUser.mutation(api.saleEvents.publishSaleEvent, { saleEventId: w.draftSaleId }),
    },
    endSaleEvent: { writesAds: false },
    expireSaleEvents: { writesAds: false },
    purchaseAddon: { writesAds: false },
    saveSaleEvent: { writesAds: false },
  },

  adDetail: {
    incrementViews: {
      writesAds: true, // patches `views` only — not derived, so no refresh needed
      exercise: (w) => w.asUser.mutation(api.adDetail.incrementViews, { adId: w.a1 }),
    },
    batchIncrementViews: {
      writesAds: true,
      exercise: (w) => w.asUser.mutation(api.adDetail.batchIncrementViews, { adIds: [w.a1, w.a3] }),
    },
    saveAd: { writesAds: false },
    sendFirstMessage: { writesAds: false },
  },

  ads: {
    incrementViews: {
      writesAds: true,
      exercise: (w) => w.asUser.mutation(api.ads.incrementViews, { adId: w.a1 }),
    },
  },

  categories: {
    createCategory: { writesAds: false },
    updateCategory: { writesAds: false },
    deleteCategory: { writesAds: false }, // reads ads to refuse deletion; never writes them
  },

  descopeAuth: { syncDescopeUser: { writesAds: false } },

  imageCleanup: {
    stampDeletedAt: {
      writesAds: true, // patches `deletedAt` on already-refreshed soft-deleted ads
      exercise: (w) => w.t.mutation(internal.imageCleanup.stampDeletedAt, { adId: w.a3 }),
    },
    markImagesPurged: {
      writesAds: true, // patches `images`/`imagesPurgedAt` — not derived
      exercise: (w) => w.t.mutation(internal.imageCleanup.markImagesPurged, { adId: w.a3 }),
    },
  },

  messages: {
    sendMessage: { writesAds: false },
    markChatAsRead: { writesAds: false },
    archiveChat: { writesAds: false },
    unarchiveChat: { writesAds: false },
    deleteArchivedChats: { writesAds: false },
  },

  migrations: {
    updateAdImages: {
      writesAds: true, // patches `images` — not derived
      exercise: (w) =>
        w.t.mutation(internal.migrations.updateAdImages, { adId: w.a1, images: ["r2:x"] }),
    },
    updateUserImage: { writesAds: false },
    updateCategoryNames: { writesAds: false },
    backfillListingType: {
      writesAds: true, // patches `listingType` — not derived
      exercise: (w) => w.t.mutation(internal.migrations.backfillListingType, {}),
    },
    addHobbiesCategory: { writesAds: false },
    ensureAllCategories: { writesAds: false },
    seedFeatureFlags: { writesAds: false },
    seedAppSettings: { writesAds: false },
    backfillSaleBundles: { writesAds: false }, // patches saleBundles bookkeeping, never ads
    backfillBumpedAt: {
      writesAds: true, // patches `bumpedAt` — not derived
      exercise: (w) => w.t.mutation(internal.migrations.backfillBumpedAt, {}),
    },
    backfillCompositeDerived: { writesAds: false }, // writes composites via the shared refresh
    renameFeatureFlag: { writesAds: false },
    applySaleLocations: {
      writesAds: true, // patches member `location` (derived!) — must refresh
      exercise: (w) =>
        w.t.mutation(internal.migrations.applySaleLocations, {
          updates: [{ saleEventId: w.saleEventId, location: "Fitzroy, VIC 3065" }],
        }),
    },
  },

  saleChats: { sendSaleMessage: { writesAds: false } },

  seed: {
    wipeSeededMovingSales: {
      writesAds: true, // hard-deletes sale items — and their sale + bundles with them
      exercise: (w) => w.t.mutation(internal.seed.wipeSeededMovingSales, {}),
    },
    setFeatureFlagLocal: { writesAds: false },
    seedMovingSale: {
      writesAds: true,
      exercise: (w) =>
        w.t.mutation(internal.seed.seedMovingSale, { email: "seller@example.com" }),
    },
    seedBundleAds: {
      writesAds: true, // inserts standalone ads — no composite membership
      exercise: (w) =>
        w.t.mutation(internal.seed.seedBundleAds, { email: "seller@example.com" }),
    },
  },

  seedTestAd: {
    seedTallImageAd: {
      writesAds: true, // inserts a standalone ad — no composite membership
      exercise: (w) => w.t.mutation(internal.seedTestAd.seedTallImageAd, {}),
    },
  },

  users: {
    updateProfile: { writesAds: false },
    deleteAccount: {
      writesAds: true, // hard-deletes the user's ads — must refresh their composites
      exercise: (w) => w.asUser.mutation(api.users.deleteAccount, {}),
    },
    verifyIdentity: { writesAds: false },
    updateEmailNotificationPreference: { writesAds: false },
  },

  admin: {
    toggleUserStatus: {
      writesAds: true,
      exercise: (w) => w.asAdmin.mutation(api.admin.toggleUserStatus, { userId: w.sellerId }),
    },
    deleteUserAccount: {
      writesAds: true,
      exercise: (w) => w.asAdmin.mutation(api.admin.deleteUserAccount, { userId: w.sellerId }),
    },
    deleteFlyerImage: {
      writesAds: true,
      exercise: (w) =>
        w.asAdmin.mutation(api.admin.deleteFlyerImage, { adId: w.a1, imageRef: "r2:b" }),
    },
    deleteFlyerAdmin: {
      writesAds: true,
      exercise: (w) => w.asAdmin.mutation(api.admin.deleteFlyerAdmin, { adId: w.a1 }),
    },
    updateReportStatus: { writesAds: false },
    toggleUserVerification: { writesAds: false },
    setAdminUser: { writesAds: false },
  },
};

// ──────────────────────────────────────────────────────────────────────────
// 1. Coverage — a new mutation cannot slip past unclassified
// ──────────────────────────────────────────────────────────────────────────

describe("refresh contract: coverage", () => {
  test("every exported mutation in every convex module is classified", () => {
    // If this fails: add the new mutation to MUTATIONS above with writesAds set
    // honestly. If it writes to `ads`, it also needs an `exercise`.
    expect(EXPORTED_MUTATIONS).toEqual(
      Object.entries(MUTATIONS)
        .flatMap(([m, cases]) => Object.keys(cases).map((name) => `${m}.${name}`))
        .sort()
    );
  });

  test("every ads-writing mutation is exercised", () => {
    const missing = Object.entries(MUTATIONS).flatMap(([m, cases]) =>
      Object.entries(cases)
        .filter(([, c]) => c.writesAds && !c.exercise)
        .map(([name]) => `${m}.${name}`)
    );
    expect(missing).toEqual([]);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// 2. The contract itself
// ──────────────────────────────────────────────────────────────────────────

describe("refresh contract: composites are never left stale", () => {
  test("the fixture itself starts consistent", async () => {
    const w = await world();
    await expectAllCompositesDerived(w.t, "fixture");
  });

  for (const [moduleName, cases] of Object.entries(MUTATIONS)) {
    for (const [name, c] of Object.entries(cases)) {
      if (!c.exercise) continue;
      test(`${moduleName}.${name} leaves every composite derived`, async () => {
        const w = await world();
        await c.exercise!(w);
        await expectAllCompositesDerived(w.t, `${moduleName}.${name}`);
      });
    }
  }
});

// ──────────────────────────────────────────────────────────────────────────
// 3. deleteUserAccount cost — the O(N²) transaction-cap blowup
// ──────────────────────────────────────────────────────────────────────────

describe("deleteUserAccount refreshes once per composite, not once per ad", () => {
  test("a 60-item sale is deletable (per-ad refresh would be ~3,700 reads)", async () => {
    // The documentsRead cap in world() is what makes this test able to fail.
    const w = await world();
    const items = Array.from({ length: 60 }, (_, i) => ({
      imageKey: `r2:bulk${i}`,
      title: `Bulk item ${i}`,
    }));
    await w.asUser.mutation(api.saleEvents.addSaleItems, {
      saleEventId: w.saleEventId,
      items,
    });

    await w.asAdmin.mutation(api.admin.deleteUserAccount, { userId: w.sellerId });

    const sale = await w.t.run((ctx) => ctx.db.get(w.saleEventId));
    expect(sale!.searchText).not.toContain("Bulk item 0");
    expect(sale!.categoryIds).toEqual([]);
    await expectAllCompositesDerived(w.t, "deleteUserAccount bulk");
  });
});

// ──────────────────────────────────────────────────────────────────────────
// 4. adIsVisible — the one liveness predicate
// ──────────────────────────────────────────────────────────────────────────

describe("adIsVisible", () => {
  const base = {
    _id: "x" as Id<"ads">,
    isDeleted: undefined,
    isSold: undefined,
    isActive: true,
  };
  test("rejects missing, deleted, sold and deactivated ads", () => {
    type Ad = Parameters<typeof adIsVisible>[0];
    expect(adIsVisible(null)).toBe(false);
    expect(adIsVisible({ ...base } as unknown as Ad)).toBe(true);
    expect(adIsVisible({ ...base, isDeleted: true } as unknown as Ad)).toBe(false);
    expect(adIsVisible({ ...base, isSold: true } as unknown as Ad)).toBe(false);
    expect(adIsVisible({ ...base, isActive: false } as unknown as Ad)).toBe(false);
  });
});
