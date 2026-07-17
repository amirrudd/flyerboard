// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

// Load all Convex modules so convex-test can run them (same loader as bundles.test.ts).
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

type T = ReturnType<typeof convexTest>;

const T0 = 1_000_000; // base sort time; entries use T0 + n so order is explicit

async function insertAd(
  t: T,
  opts: {
    userId: Id<"users">;
    categoryId: Id<"categories">;
    bumpedAt: number;
    title?: string;
    isActive?: boolean;
    isDeleted?: boolean;
    isSold?: boolean;
    price?: number;
    images?: string[];
    saleEventId?: Id<"saleEvents">;
  }
): Promise<Id<"ads">> {
  return t.run(async (ctx) =>
    ctx.db.insert("ads", {
      title: opts.title ?? "Item",
      description: "desc",
      price: opts.price ?? 100,
      location: "Richmond, VIC",
      categoryId: opts.categoryId,
      images: opts.images ?? ["r2:flyers/x/1.jpg"],
      userId: opts.userId,
      isActive: opts.isActive ?? true,
      views: 0,
      bumpedAt: opts.bumpedAt,
      ...(opts.isDeleted !== undefined ? { isDeleted: opts.isDeleted } : {}),
      ...(opts.isSold !== undefined ? { isSold: opts.isSold } : {}),
      ...(opts.saleEventId ? { saleEventId: opts.saleEventId } : {}),
    })
  );
}

/** Insert a standalone bundle + its member ads. Returns the bundle id. */
async function insertBundle(
  t: T,
  opts: {
    userId: Id<"users">;
    categoryId: Id<"categories">;
    bumpedAt: number;
    status?: "active" | "partial" | "sold" | "cancelled";
    isDeleted?: boolean;
    saleEventId?: Id<"saleEvents">;
    soldMembers?: number; // how many of the 2 member ads are sold
  }
): Promise<Id<"saleBundles">> {
  const memberBumped = 1; // far below T0 — members shouldn't interfere with order assertions
  const a = await insertAd(t, {
    userId: opts.userId,
    categoryId: opts.categoryId,
    bumpedAt: memberBumped,
    isSold: (opts.soldMembers ?? 0) >= 1,
    isActive: false, // keep members out of the ads stream entirely
  });
  const b = await insertAd(t, {
    userId: opts.userId,
    categoryId: opts.categoryId,
    bumpedAt: memberBumped,
    isSold: (opts.soldMembers ?? 0) >= 2,
    isActive: false,
  });
  return t.run(async (ctx) =>
    ctx.db.insert("saleBundles", {
      sellerId: opts.userId,
      adIds: [a, b],
      bundlePrice: 150,
      label: "Bundle",
      status: opts.status ?? "active",
      bumpedAt: opts.bumpedAt,
      ...(opts.isDeleted !== undefined ? { isDeleted: opts.isDeleted } : {}),
      ...(opts.saleEventId ? { saleEventId: opts.saleEventId } : {}),
    })
  );
}

/** Insert a sale event (+ one item so the card hydrates non-trivially). */
async function insertSale(
  t: T,
  opts: {
    userId: Id<"users">;
    categoryId: Id<"categories">;
    bumpedAt?: number;
    status?: "draft" | "active" | "ended";
    slug?: string | null; // null = omit slug (unpublished-looking row)
    expiresAt?: number;
  }
): Promise<Id<"saleEvents">> {
  const saleId = await t.run(async (ctx) =>
    ctx.db.insert("saleEvents", {
      userId: opts.userId,
      title: "Moving Sale",
      suburb: "Richmond, VIC",
      pickupWindowStart: T0,
      pickupWindowEnd: T0 + 1000,
      status: opts.status ?? "active",
      createdAt: T0,
      ...(opts.slug === null ? {} : { slug: opts.slug ?? `sale-${Math.random().toString(36).slice(2, 8)}` }),
      ...(opts.bumpedAt !== undefined ? { bumpedAt: opts.bumpedAt } : {}),
      ...(opts.expiresAt !== undefined ? { expiresAt: opts.expiresAt } : {}),
    })
  );
  await insertAd(t, {
    userId: opts.userId,
    categoryId: opts.categoryId,
    bumpedAt: 1,
    isActive: false, // sale items stay out of the ads stream for order assertions
    saleEventId: saleId,
  });
  return saleId;
}

async function setFlag(t: T, key: string, enabled: boolean) {
  await t.run(async (ctx) => {
    // .filter, not .withIndex: `ReturnType<typeof convexTest>` erases the schema
    // generic, so index names don't type-check inside these helpers.
    const existing = await ctx.db
      .query("featureFlags")
      .filter((q) => q.eq(q.field("key"), key))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { enabled });
    } else {
      await ctx.db.insert("featureFlags", { key, enabled, description: "test" });
    }
  });
}

/** Fresh harness with both composite flags enabled (the common case). */
async function fresh() {
  const t = convexTest(schema, modules);
  const userId = await t.run(async (ctx) =>
    ctx.db.insert("users", { tokenIdentifier: "u1", name: "Tester", isActive: true })
  );
  const categoryId = await t.run(async (ctx) =>
    ctx.db.insert("categories", { name: "Other", slug: "other" })
  );
  await setFlag(t, "bundleListing", true);
  await setFlag(t, "movingSaleMode", true);
  return { t, userId, categoryId };
}

function getPage(
  t: T,
  args: { numItems?: number; cursor?: string | null; categoryId?: Id<"categories">; maxSortTime?: number } = {}
) {
  return t.query(api.feed.getFeed, {
    paginationOpts: { numItems: args.numItems ?? 20, cursor: args.cursor ?? null },
    ...(args.categoryId ? { categoryId: args.categoryId } : {}),
    ...(args.maxSortTime !== undefined ? { maxSortTime: args.maxSortTime } : {}),
  });
}

type FeedEntry = Awaited<ReturnType<typeof getPage>>["page"][number];

/** Stable identity for dedupe/order assertions: kind + id. */
function entryKey(e: FeedEntry): string {
  return e.kind === "ad" ? `ad:${e.ad._id}` : `${e.kind}:${e.card._id}`;
}

// ──────────────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────────────

describe("getFeed — interleaving", () => {
  test("interleaves ads, bundles, and sales strictly by bumpedAt desc", async () => {
    const { t, userId, categoryId } = await fresh();
    // bumpedAt: sale=T0+50 > ad2=T0+40 > bundle=T0+30 > ad1=T0+20
    const ad1 = await insertAd(t, { userId, categoryId, bumpedAt: T0 + 20 });
    const bundleId = await insertBundle(t, { userId, categoryId, bumpedAt: T0 + 30 });
    const ad2 = await insertAd(t, { userId, categoryId, bumpedAt: T0 + 40 });
    const saleId = await insertSale(t, { userId, categoryId, bumpedAt: T0 + 50 });

    const result = await getPage(t, { maxSortTime: T0 + 100 });
    expect(result.page.map(entryKey)).toEqual([
      `sale:${saleId}`,
      `ad:${ad2}`,
      `bundle:${bundleId}`,
      `ad:${ad1}`,
    ]);
  });

  test("bundle card matches the getActiveBundleFeedCards shape", async () => {
    const { t, userId, categoryId } = await fresh();
    await insertBundle(t, { userId, categoryId, bumpedAt: T0 + 10 });

    const result = await getPage(t, { maxSortTime: T0 + 100 });
    const entry = result.page.find((e) => e.kind === "bundle");
    expect(entry).toBeDefined();
    if (entry?.kind !== "bundle") throw new Error("unreachable");
    expect(entry.card).toMatchObject({
      label: "Bundle",
      itemCount: 2,
      bundlePrice: 150,
      separatelyTotal: 200,
      savings: 50,
    });
    expect(entry.card.covers).toHaveLength(2);
    expect(entry.card.adIds).toHaveLength(2);
  });

  test("sale card matches the getActiveSales shape", async () => {
    const { t, userId, categoryId } = await fresh();
    const saleId = await insertSale(t, { userId, categoryId, bumpedAt: T0 + 10, slug: "my-sale-x1y2" });

    const result = await getPage(t, { maxSortTime: T0 + 100 });
    const entry = result.page.find((e) => e.kind === "sale");
    expect(entry).toBeDefined();
    if (entry?.kind !== "sale") throw new Error("unreachable");
    expect(entry.card).toMatchObject({
      _id: saleId,
      slug: "my-sale-x1y2",
      title: "Moving Sale",
      suburb: "Richmond, VIC",
      itemCount: 1,
      photoCount: 1,
      minPrice: 100,
    });
    expect(entry.card.covers).toHaveLength(1);
  });
});

describe("getFeed — page boundaries", () => {
  test("a composite whose bumpedAt falls between pages appears exactly once, on the right page", async () => {
    const { t, userId, categoryId } = await fresh();
    // 5 entries desc: ad(T0+50), ad(T0+40), bundle(T0+35), ad(T0+30), ad(T0+20).
    // With numItems=2 the bundle lands on page 2.
    await insertAd(t, { userId, categoryId, bumpedAt: T0 + 50 });
    await insertAd(t, { userId, categoryId, bumpedAt: T0 + 40 });
    const bundleId = await insertBundle(t, { userId, categoryId, bumpedAt: T0 + 35 });
    await insertAd(t, { userId, categoryId, bumpedAt: T0 + 30 });
    await insertAd(t, { userId, categoryId, bumpedAt: T0 + 20 });

    const seen: string[] = [];
    let cursor: string | null = null;
    let isDone = false;
    while (!isDone) {
      const result = await getPage(t, { numItems: 2, cursor, maxSortTime: T0 + 100 });
      seen.push(...result.page.map(entryKey));
      cursor = result.continueCursor;
      isDone = result.isDone;
    }

    // Exactly once, in strict global order.
    expect(seen.filter((k) => k === `bundle:${bundleId}`)).toHaveLength(1);
    expect(seen.indexOf(`bundle:${bundleId}`)).toBe(2); // third item overall
    expect(new Set(seen).size).toBe(seen.length); // no duplicates anywhere
    expect(seen).toHaveLength(5);
  });
});

describe("getFeed — feature flags", () => {
  test("bundleListing off excludes bundles but keeps sales and ads", async () => {
    const { t, userId, categoryId } = await fresh();
    await setFlag(t, "bundleListing", false);
    await insertAd(t, { userId, categoryId, bumpedAt: T0 + 10 });
    await insertBundle(t, { userId, categoryId, bumpedAt: T0 + 20 });
    await insertSale(t, { userId, categoryId, bumpedAt: T0 + 30 });

    const result = await getPage(t, { maxSortTime: T0 + 100 });
    expect(result.page.map((e) => e.kind)).toEqual(["sale", "ad"]);
  });

  test("movingSaleMode off excludes sales but keeps bundles and ads", async () => {
    const { t, userId, categoryId } = await fresh();
    await setFlag(t, "movingSaleMode", false);
    await insertAd(t, { userId, categoryId, bumpedAt: T0 + 10 });
    await insertBundle(t, { userId, categoryId, bumpedAt: T0 + 20 });
    await insertSale(t, { userId, categoryId, bumpedAt: T0 + 30 });

    const result = await getPage(t, { maxSortTime: T0 + 100 });
    expect(result.page.map((e) => e.kind)).toEqual(["bundle", "ad"]);
  });

  test("missing flag rows behave as disabled (ads-only feed)", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) =>
      ctx.db.insert("users", { tokenIdentifier: "u1", name: "Tester", isActive: true })
    );
    const categoryId = await t.run(async (ctx) =>
      ctx.db.insert("categories", { name: "Other", slug: "other" })
    );
    await insertAd(t, { userId, categoryId, bumpedAt: T0 + 10 });
    await insertBundle(t, { userId, categoryId, bumpedAt: T0 + 20 });
    await insertSale(t, { userId, categoryId, bumpedAt: T0 + 30 });

    const result = await getPage(t, { maxSortTime: T0 + 100 });
    expect(result.page.map((e) => e.kind)).toEqual(["ad"]);
  });
});

describe("getFeed — category branch", () => {
  test("returns ads only, filtered to the category; composites never appear", async () => {
    const { t, userId, categoryId } = await fresh();
    const otherCategoryId = await t.run(async (ctx) =>
      ctx.db.insert("categories", { name: "Books", slug: "books" })
    );
    const inCat = await insertAd(t, { userId, categoryId, bumpedAt: T0 + 10 });
    await insertAd(t, { userId, categoryId: otherCategoryId, bumpedAt: T0 + 20 });
    await insertBundle(t, { userId, categoryId, bumpedAt: T0 + 30 });
    await insertSale(t, { userId, categoryId, bumpedAt: T0 + 40 });

    const result = await getPage(t, { categoryId, maxSortTime: T0 + 100 });
    expect(result.page.map(entryKey)).toEqual([`ad:${inCat}`]);
  });

  test("category branch applies the getAds predicate set", async () => {
    const { t, userId, categoryId } = await fresh();
    const live = await insertAd(t, { userId, categoryId, bumpedAt: T0 + 10 });
    await insertAd(t, { userId, categoryId, bumpedAt: T0 + 20, isDeleted: true });
    await insertAd(t, { userId, categoryId, bumpedAt: T0 + 30, isSold: true });
    await insertAd(t, { userId, categoryId, bumpedAt: T0 + 40, isActive: false });

    const result = await getPage(t, { categoryId, maxSortTime: T0 + 100 });
    expect(result.page.map(entryKey)).toEqual([`ad:${live}`]);
  });
});

describe("getFeed — exclusions", () => {
  test("deleted/inactive ads and sold ads are excluded from the merged feed", async () => {
    const { t, userId, categoryId } = await fresh();
    const live = await insertAd(t, { userId, categoryId, bumpedAt: T0 + 10 });
    await insertAd(t, { userId, categoryId, bumpedAt: T0 + 20, isDeleted: true });
    await insertAd(t, { userId, categoryId, bumpedAt: T0 + 30, isSold: true });
    await insertAd(t, { userId, categoryId, bumpedAt: T0 + 40, isActive: false });

    const result = await getPage(t, { maxSortTime: T0 + 100 });
    expect(result.page.map(entryKey)).toEqual([`ad:${live}`]);
  });

  test("non-active-status, deleted, and sale-scoped bundles are excluded", async () => {
    const { t, userId, categoryId } = await fresh();
    await insertBundle(t, { userId, categoryId, bumpedAt: T0 + 10, status: "partial" });
    await insertBundle(t, { userId, categoryId, bumpedAt: T0 + 20, status: "sold" });
    await insertBundle(t, { userId, categoryId, bumpedAt: T0 + 30, status: "cancelled" });
    await insertBundle(t, { userId, categoryId, bumpedAt: T0 + 40, isDeleted: true });
    const saleId = await insertSale(t, { userId, categoryId, bumpedAt: T0 + 50 });
    await insertBundle(t, { userId, categoryId, bumpedAt: T0 + 60, saleEventId: saleId });
    const liveBundle = await insertBundle(t, { userId, categoryId, bumpedAt: T0 + 5 });

    const result = await getPage(t, { maxSortTime: T0 + 100 });
    const bundles = result.page.filter((e) => e.kind === "bundle");
    expect(bundles.map((e) => (e.kind === "bundle" ? e.card._id : null))).toEqual([liveBundle]);
  });

  test("draft, ended, expired, and slugless sales are excluded", async () => {
    const { t, userId, categoryId } = await fresh();
    await insertSale(t, { userId, categoryId, bumpedAt: T0 + 10, status: "draft" });
    await insertSale(t, { userId, categoryId, bumpedAt: T0 + 20, status: "ended" });
    await insertSale(t, { userId, categoryId, bumpedAt: T0 + 30, expiresAt: 5 }); // long past
    await insertSale(t, { userId, categoryId, bumpedAt: T0 + 40, slug: null });
    const live = await insertSale(t, { userId, categoryId, bumpedAt: T0 + 5 });

    const result = await getPage(t, { maxSortTime: T0 + 100 });
    const sales = result.page.filter((e) => e.kind === "sale");
    expect(sales.map((e) => (e.kind === "sale" ? e.card._id : null))).toEqual([live]);
  });

  test("a sale with undefined bumpedAt (pre-backfill row) is excluded", async () => {
    const { t, userId, categoryId } = await fresh();
    await insertSale(t, { userId, categoryId }); // no bumpedAt
    const result = await getPage(t, { maxSortTime: T0 + 100 });
    expect(result.page.filter((e) => e.kind === "sale")).toHaveLength(0);
  });

  test("a bundle whose live members drop below 2 is excluded from the page", async () => {
    const { t, userId, categoryId } = await fresh();
    // Status still "active" but one member sold individually — despawn rule.
    await insertBundle(t, { userId, categoryId, bumpedAt: T0 + 10, soldMembers: 1 });
    const ad = await insertAd(t, { userId, categoryId, bumpedAt: T0 + 5 });

    const result = await getPage(t, { maxSortTime: T0 + 100 });
    expect(result.page.map(entryKey)).toEqual([`ad:${ad}`]);
  });
});

describe("getFeed — maxSortTime", () => {
  test("caps all three streams at the frozen sort time", async () => {
    const { t, userId, categoryId } = await fresh();
    const cutoff = T0 + 100;
    // Below the cutoff — included.
    const oldAd = await insertAd(t, { userId, categoryId, bumpedAt: T0 + 10 });
    const oldBundle = await insertBundle(t, { userId, categoryId, bumpedAt: T0 + 20 });
    const oldSale = await insertSale(t, { userId, categoryId, bumpedAt: T0 + 30 });
    // Above the cutoff — excluded from this frozen feed.
    await insertAd(t, { userId, categoryId, bumpedAt: cutoff + 1 });
    await insertBundle(t, { userId, categoryId, bumpedAt: cutoff + 1 });
    await insertSale(t, { userId, categoryId, bumpedAt: cutoff + 1 });

    const result = await getPage(t, { maxSortTime: cutoff });
    expect(result.page.map(entryKey)).toEqual([
      `sale:${oldSale}`,
      `bundle:${oldBundle}`,
      `ad:${oldAd}`,
    ]);
  });
});
