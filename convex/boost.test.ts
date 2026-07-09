// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import schema from "./schema";
import { api, internal } from "./_generated/api";
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
// backfillBumpedAt migration (Phase 1A)
// ──────────────────────────────────────────────────────────────────────────
describe("migrations.backfillBumpedAt", () => {
  /** Insert a legacy ad row directly, WITHOUT bumpedAt (simulates a pre-Boost ad). */
  async function seedLegacyAd(
    t: ReturnType<typeof convexTest>,
    userId: Id<"users">,
    categoryId: Id<"categories">
  ): Promise<Id<"ads">> {
    return t.run(async (ctx) =>
      ctx.db.insert("ads", {
        title: "Legacy ad",
        description: "",
        location: "Richmond, VIC",
        categoryId,
        images: ["r2:legacy"],
        userId,
        isActive: true,
        views: 0,
      })
    );
  }

  test("stamps bumpedAt = _creationTime and is idempotent", async () => {
    const { t, userId, categoryId } = await freshWithUser();
    const a = await seedLegacyAd(t, userId, categoryId);
    const b = await seedLegacyAd(t, userId, categoryId);

    // Precondition: both rows undefined.
    const preA = await t.run((ctx) => ctx.db.get(a));
    expect(preA!.bumpedAt).toBeUndefined();

    // First run backfills everything.
    const first = await t.mutation(internal.migrations.backfillBumpedAt, {});
    expect(first.processed).toBe(2);
    expect(first.remaining).toBe(0);
    expect(first.done).toBe(true);

    const adA = await t.run((ctx) => ctx.db.get(a));
    const adB = await t.run((ctx) => ctx.db.get(b));
    expect(adA!.bumpedAt).toBe(adA!._creationTime);
    expect(adB!.bumpedAt).toBe(adB!._creationTime);

    // Second run is a no-op — idempotent (nothing left to process).
    const second = await t.mutation(internal.migrations.backfillBumpedAt, {});
    expect(second.processed).toBe(0);
    expect(second.remaining).toBe(0);
    expect(second.done).toBe(true);

    // Values unchanged by the re-run.
    const adAAgain = await t.run((ctx) => ctx.db.get(a));
    expect(adAAgain!.bumpedAt).toBe(adA!.bumpedAt);
  });

  test("respects batchSize and reports remaining across runs", async () => {
    const { t, userId, categoryId } = await freshWithUser();
    await seedLegacyAd(t, userId, categoryId);
    await seedLegacyAd(t, userId, categoryId);
    await seedLegacyAd(t, userId, categoryId);

    const run1 = await t.mutation(internal.migrations.backfillBumpedAt, { batchSize: 2 });
    expect(run1.processed).toBe(2);
    expect(run1.remaining).toBe(1);
    expect(run1.done).toBe(false);

    const run2 = await t.mutation(internal.migrations.backfillBumpedAt, { batchSize: 2 });
    expect(run2.processed).toBe(1);
    expect(run2.remaining).toBe(0);
    expect(run2.done).toBe(true);
  });
});
