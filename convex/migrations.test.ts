// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import schema from "./schema";
import { internal } from "./_generated/api";
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
// backfillFeedBumpedAt — unified-feed bumpedAt backfill
// ──────────────────────────────────────────────────────────────────────────
describe("backfillFeedBumpedAt", () => {
  /** Seed one legacy bundle (no status, no bumpedAt), one modern bundle, and
   *  one legacy sale (no bumpedAt) plus one modern sale. */
  async function seed() {
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        tokenIdentifier: "u1",
        name: "Tester",
        isActive: true,
      });
      // Legacy Moving Sale bundle: predates sellerId/status/bumpedAt.
      const legacyBundleId = await ctx.db.insert("saleBundles", {
        label: "Legacy bundle",
        bundlePrice: 50,
        adIds: [],
      });
      // Modern bundle: everything set.
      const modernBundleId = await ctx.db.insert("saleBundles", {
        sellerId: userId,
        label: "Modern bundle",
        bundlePrice: 80,
        adIds: [],
        status: "partial",
        bumpedAt: 12345,
      });
      const legacySaleId = await ctx.db.insert("saleEvents", {
        userId,
        title: "Legacy sale",
        suburb: "Richmond, VIC",
        pickupWindowStart: 1000,
        pickupWindowEnd: 2000,
        status: "active",
        createdAt: 777,
      });
      const modernSaleId = await ctx.db.insert("saleEvents", {
        userId,
        title: "Modern sale",
        suburb: "Richmond, VIC",
        pickupWindowStart: 1000,
        pickupWindowEnd: 2000,
        status: "active",
        createdAt: 888,
        bumpedAt: 999,
      });
      return { legacyBundleId, modernBundleId, legacySaleId, modernSaleId };
    });
    return { t, ...ids };
  }

  async function snapshot(
    t: ReturnType<typeof convexTest>,
    ids: { legacyBundleId: Id<"saleBundles">; modernBundleId: Id<"saleBundles">; legacySaleId: Id<"saleEvents">; modernSaleId: Id<"saleEvents"> }
  ) {
    return t.run(async (ctx) => ({
      legacyBundle: await ctx.db.get(ids.legacyBundleId),
      modernBundle: await ctx.db.get(ids.modernBundleId),
      legacySale: await ctx.db.get(ids.legacySaleId),
      modernSale: await ctx.db.get(ids.modernSaleId),
    }));
  }

  test("backfills bumpedAt and normalises missing bundle status to active", async () => {
    const { t, ...ids } = await seed();
    await t.mutation(internal.migrations.backfillFeedBumpedAt, {});
    const s = await snapshot(t, ids);

    // Legacy bundle: status normalised, bumpedAt = _creationTime.
    expect(s.legacyBundle!.status).toBe("active");
    expect(s.legacyBundle!.bumpedAt).toBe(s.legacyBundle!._creationTime);
    // Legacy sale: bumpedAt = createdAt.
    expect(s.legacySale!.bumpedAt).toBe(777);
    // Modern rows untouched.
    expect(s.modernBundle!.status).toBe("partial");
    expect(s.modernBundle!.bumpedAt).toBe(12345);
    expect(s.modernSale!.bumpedAt).toBe(999);
  });

  test("is idempotent — second run patches nothing and changes nothing", async () => {
    const { t, ...ids } = await seed();
    await t.mutation(internal.migrations.backfillFeedBumpedAt, {});
    const first = await snapshot(t, ids);

    const second = await t.mutation(internal.migrations.backfillFeedBumpedAt, {});
    expect(second.results.bundlesPatched).toBe(0);
    expect(second.results.salesPatched).toBe(0);
    expect(await snapshot(t, ids)).toEqual(first);
  });
});
