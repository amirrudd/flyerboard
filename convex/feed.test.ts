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
    location?: string;
    saleEventId?: Id<"saleEvents">;
  }
): Promise<Id<"ads">> {
  return t.run(async (ctx) =>
    ctx.db.insert("ads", {
      title: opts.title ?? "Item",
      description: "desc",
      price: opts.price ?? 100,
      location: opts.location ?? "Richmond, VIC",
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

/**
 * Composite members sort ABOVE every `maxSortTime` these tests pass, which keeps
 * them out of the ads stream (`.lte("bumpedAt", maxSortTime)`) without making
 * them invisible. They used to be `isActive: false` instead — but a card now
 * hydrates from `adIsVisible` members only, so an inactive member is no member
 * at all and every composite here would despawn.
 */
const MEMBER_BUMPED = Number.MAX_SAFE_INTEGER;

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
    categoryIds?: Id<"categories">[]; // derived-from-members copy (wave 1)
    locations?: string[] | null; // derived-from-members copy; null = omit (no live members)
  }
): Promise<Id<"saleBundles">> {
  const a = await insertAd(t, {
    userId: opts.userId,
    categoryId: opts.categoryId,
    bumpedAt: MEMBER_BUMPED,
    isSold: (opts.soldMembers ?? 0) >= 1,
  });
  const b = await insertAd(t, {
    userId: opts.userId,
    categoryId: opts.categoryId,
    bumpedAt: MEMBER_BUMPED,
    isSold: (opts.soldMembers ?? 0) >= 2,
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
      ...(opts.categoryIds ? { categoryIds: opts.categoryIds } : {}),
      ...(opts.locations === null || opts.locations === undefined
        ? {}
        : { locations: opts.locations }),
    })
  );
}

/** Insert a sale event (+ one item so the card hydrates non-trivially). */
async function insertSale(
  t: T,
  opts: {
    userId: Id<"users">;
    categoryId: Id<"categories">;
    bumpedAt: number;
    status?: "draft" | "active" | "ended";
    slug?: string | null; // null = omit slug (unpublished-looking row)
    expiresAt?: number;
    categoryIds?: Id<"categories">[]; // derived-from-members copy (wave 1)
    locations?: string[] | null; // derived-from-members copy; null = omit (no live members)
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
      bumpedAt: opts.bumpedAt,
      ...(opts.expiresAt !== undefined ? { expiresAt: opts.expiresAt } : {}),
      ...(opts.categoryIds ? { categoryIds: opts.categoryIds } : {}),
      ...(opts.locations === null || opts.locations === undefined
        ? {}
        : { locations: opts.locations }),
    })
  );
  await insertAd(t, {
    userId: opts.userId,
    categoryId: opts.categoryId,
    bumpedAt: MEMBER_BUMPED,
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

describe("getFeed — category filter", () => {
  // Rule 4 (.agent/PRODUCT-RULES.md): all three ad types are eligible for every
  // filter. Rule 1: a composite is in a category when any member ad is.
  test("filters ads to the category and keeps composites whose members match", async () => {
    const { t, userId, categoryId } = await fresh();
    const otherCategoryId = await t.run(async (ctx) =>
      ctx.db.insert("categories", { name: "Books", slug: "books" })
    );
    const inCat = await insertAd(t, { userId, categoryId, bumpedAt: T0 + 10 });
    await insertAd(t, { userId, categoryId: otherCategoryId, bumpedAt: T0 + 20 });
    const bundleId = await insertBundle(t, {
      userId,
      categoryId,
      bumpedAt: T0 + 30,
      categoryIds: [categoryId],
    });
    const saleId = await insertSale(t, {
      userId,
      categoryId,
      bumpedAt: T0 + 40,
      categoryIds: [categoryId],
    });

    const result = await getPage(t, { categoryId, maxSortTime: T0 + 100 });
    expect(result.page.map(entryKey)).toEqual([
      `sale:${saleId}`,
      `bundle:${bundleId}`,
      `ad:${inCat}`,
    ]);
  });

  test("composites whose members are in another category do not appear", async () => {
    const { t, userId, categoryId } = await fresh();
    const otherCategoryId = await t.run(async (ctx) =>
      ctx.db.insert("categories", { name: "Books", slug: "books" })
    );
    const inCat = await insertAd(t, { userId, categoryId, bumpedAt: T0 + 10 });
    await insertBundle(t, {
      userId,
      categoryId: otherCategoryId,
      bumpedAt: T0 + 30,
      categoryIds: [otherCategoryId],
    });
    await insertSale(t, {
      userId,
      categoryId: otherCategoryId,
      bumpedAt: T0 + 40,
      categoryIds: [otherCategoryId],
    });

    const result = await getPage(t, { categoryId, maxSortTime: T0 + 100 });
    expect(result.page.map(entryKey)).toEqual([`ad:${inCat}`]);
  });

  test("a legacy composite with no categoryIds is skipped, not crashed on", async () => {
    const { t, userId, categoryId } = await fresh();
    const inCat = await insertAd(t, { userId, categoryId, bumpedAt: T0 + 10 });
    await insertBundle(t, { userId, categoryId, bumpedAt: T0 + 30 }); // field absent
    await insertSale(t, { userId, categoryId, bumpedAt: T0 + 40 }); // field absent

    const result = await getPage(t, { categoryId, maxSortTime: T0 + 100 });
    expect(result.page.map(entryKey)).toEqual([`ad:${inCat}`]);
  });

  test("composites and ads interleave strictly by bumpedAt desc within a category", async () => {
    const { t, userId, categoryId } = await fresh();
    const ad1 = await insertAd(t, { userId, categoryId, bumpedAt: T0 + 20 });
    const bundleId = await insertBundle(t, {
      userId,
      categoryId,
      bumpedAt: T0 + 30,
      categoryIds: [categoryId],
    });
    const ad2 = await insertAd(t, { userId, categoryId, bumpedAt: T0 + 40 });
    const saleId = await insertSale(t, {
      userId,
      categoryId,
      bumpedAt: T0 + 50,
      categoryIds: [categoryId],
    });

    const result = await getPage(t, { categoryId, maxSortTime: T0 + 100 });
    expect(result.page.map(entryKey)).toEqual([
      `sale:${saleId}`,
      `ad:${ad2}`,
      `bundle:${bundleId}`,
      `ad:${ad1}`,
    ]);
  });

  test("the category feed applies the same ad predicate set", async () => {
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

  test("a bundle whose live members drop below 2 is excluded from the page", async () => {
    const { t, userId, categoryId } = await fresh();
    // Status still "active" but one member sold individually — despawn rule.
    await insertBundle(t, { userId, categoryId, bumpedAt: T0 + 10, soldMembers: 1 });
    const ad = await insertAd(t, { userId, categoryId, bumpedAt: T0 + 5 });

    const result = await getPage(t, { maxSortTime: T0 + 100 });
    expect(result.page.map(entryKey)).toEqual([`ad:${ad}`]);
  });
});

describe("getFeed — location groups, it doesn't hide (rule 5)", () => {
  test("a location stamps a tier on every ad type; nothing is hidden", async () => {
    const { t, userId, categoryId } = await fresh();
    const richmond = await insertAd(t, { userId, categoryId, bumpedAt: T0 + 10 }); // "Richmond, VIC"
    const elsewhere = await insertAd(t, { userId, categoryId, bumpedAt: T0 + 20, location: "Perth, WA" });
    const localBundle = await insertBundle(t, {
      userId, categoryId, bumpedAt: T0 + 30, locations: ["Richmond, VIC"],
    });
    const remoteBundle = await insertBundle(t, {
      userId, categoryId, bumpedAt: T0 + 35, locations: ["Perth, WA"],
    });
    const localSale = await insertSale(t, {
      userId, categoryId, bumpedAt: T0 + 40, locations: ["Richmond, VIC"],
    });
    const remoteSale = await insertSale(t, {
      userId, categoryId, bumpedAt: T0 + 45, locations: ["Perth, WA"],
    });

    const result = await t.query(api.feed.getFeed, {
      paginationOpts: { numItems: 20, cursor: null },
      location: "Richmond, VIC",
      maxSortTime: T0 + 100,
    });
    // Nothing the unfiltered feed would return is missing, order is untouched
    // (bumpedAt desc — the client partitions on tier at render).
    expect(result.page.map(entryKey)).toEqual([
      `sale:${remoteSale}`,
      `sale:${localSale}`,
      `bundle:${remoteBundle}`,
      `bundle:${localBundle}`,
      `ad:${elsewhere}`,
      `ad:${richmond}`,
    ]);
    const tiers = Object.fromEntries(result.page.map((e) => [entryKey(e), e.tier]));
    expect(tiers).toEqual({
      [`ad:${richmond}`]: "near",
      [`ad:${elsewhere}`]: "far",
      [`bundle:${localBundle}`]: "near",
      [`bundle:${remoteBundle}`]: "far",
      [`sale:${localSale}`]: "near",
      [`sale:${remoteSale}`]: "far",
    });
  });

  test("with no location set the response carries no tier at all", async () => {
    const { t, userId, categoryId } = await fresh();
    await insertAd(t, { userId, categoryId, bumpedAt: T0 + 10 });
    await insertBundle(t, { userId, categoryId, bumpedAt: T0 + 20, locations: ["Richmond, VIC"] });
    await insertSale(t, { userId, categoryId, bumpedAt: T0 + 30, locations: ["Richmond, VIC"] });

    const result = await getPage(t, { maxSortTime: T0 + 100 });
    expect(result.page).toHaveLength(3);
    // Genuinely absent, not undefined — the no-location response must stay
    // byte-identical to the pre-tier feed.
    for (const entry of result.page) {
      expect("tier" in entry).toBe(false);
    }
  });

  test("a composite with no derived location tiers as far, not hidden", async () => {
    const { t, userId, categoryId } = await fresh();
    const bundleId = await insertBundle(t, { userId, categoryId, bumpedAt: T0 + 30, locations: null });
    const saleId = await insertSale(t, { userId, categoryId, bumpedAt: T0 + 40, locations: null });

    const filtered = await t.query(api.feed.getFeed, {
      paginationOpts: { numItems: 20, cursor: null },
      location: "Richmond, VIC",
      maxSortTime: T0 + 100,
    });
    expect(filtered.page.map((e) => [entryKey(e), e.tier])).toEqual([
      [`sale:${saleId}`, "far"],
      [`bundle:${bundleId}`, "far"],
    ]);
  });

  test("category stays a requirement while location only tiers (rule 5)", async () => {
    const { t, userId, categoryId } = await fresh();
    const otherCategoryId = await t.run(async (ctx) =>
      ctx.db.insert("categories", { name: "Books", slug: "books" })
    );
    const richmond = await insertAd(t, { userId, categoryId, bumpedAt: T0 + 10 });
    const perth = await insertAd(t, { userId, categoryId, bumpedAt: T0 + 20, location: "Perth, WA" });
    await insertAd(t, { userId, categoryId: otherCategoryId, bumpedAt: T0 + 30 });

    const result = await t.query(api.feed.getFeed, {
      paginationOpts: { numItems: 20, cursor: null },
      categoryId,
      location: "Richmond, VIC",
      maxSortTime: T0 + 100,
    });
    // The out-of-category ad is gone; the out-of-area one is tiered, not gone.
    expect(result.page.map((e) => [entryKey(e), e.tier])).toEqual([
      [`ad:${perth}`, "far"],
      [`ad:${richmond}`, "near"],
    ]);
  });
});

describe("getFeed — a composite card never outlives its members", () => {
  test("an all-sold Moving Sale renders no card at all (rule 4)", async () => {
    const { t, userId, categoryId } = await fresh();
    const saleId = await insertSale(t, {
      userId,
      categoryId,
      bumpedAt: T0 + 10,
      locations: ["Richmond, VIC"],
    });
    // Sell the sale's only item. Derivation already discounts it, so the row's
    // locations/categoryIds go empty — the card must go with them, or it shows
    // in the unfiltered feed and in no filtered one.
    await t.run(async (ctx) => {
      const item = await ctx.db
        .query("ads")
        .filter((q) => q.eq(q.field("saleEventId"), saleId))
        .first();
      await ctx.db.patch(item!._id, { isSold: true });
    });

    const unfiltered = await getPage(t, { maxSortTime: T0 + 100 });
    expect(unfiltered.page.map(entryKey)).toEqual([]);
  });

  test("a Bundle whose members were deactivated despawns like a sold one", async () => {
    const { t, userId, categoryId } = await fresh();
    const bundleId = await insertBundle(t, { userId, categoryId, bumpedAt: T0 + 10 });
    await t.run(async (ctx) => {
      const bundle = await ctx.db.get(bundleId);
      for (const adId of bundle!.adIds) await ctx.db.patch(adId, { isActive: false });
    });

    const result = await getPage(t, { maxSortTime: T0 + 100 });
    expect(result.page.map(entryKey)).toEqual([]);
  });

  test("itemCount counts only the members the card still stands for", async () => {
    const { t, userId, categoryId } = await fresh();
    const saleId = await insertSale(t, { userId, categoryId, bumpedAt: T0 + 10 });
    // Two more items, one of them sold.
    await insertAd(t, { userId, categoryId, bumpedAt: MEMBER_BUMPED, saleEventId: saleId });
    await insertAd(t, {
      userId,
      categoryId,
      bumpedAt: MEMBER_BUMPED,
      saleEventId: saleId,
      isSold: true,
    });

    const result = await getPage(t, { maxSortTime: T0 + 100 });
    const entry = result.page[0];
    expect(entry.kind).toBe("sale");
    expect(entry.kind === "sale" && entry.card.itemCount).toBe(2);
  });

  test("a composite matches ANY member's suburb, not just the first (rule 1)", async () => {
    const { t, userId, categoryId } = await fresh();
    const bundleId = await insertBundle(t, {
      userId,
      categoryId,
      bumpedAt: T0 + 10,
      locations: ["Richmond, VIC", "Bondi, NSW"],
    });

    for (const location of ["Richmond, VIC", "Bondi, NSW"]) {
      const result = await t.query(api.feed.getFeed, {
        paginationOpts: { numItems: 20, cursor: null },
        location,
        maxSortTime: T0 + 100,
      });
      expect(result.page.map((e) => [entryKey(e), e.tier]), location).toEqual([
        [`bundle:${bundleId}`, "near"],
      ]);
    }
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
