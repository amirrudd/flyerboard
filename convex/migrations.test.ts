// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { expect, test, describe } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { internal } from "./_generated/api";
import { resolveSuburb } from "./migrations";

// Load all Convex modules so convex-test can run them (same loader as feed.test.ts).
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

/**
 * The suburb resolver behind `backfillSaleSuburbLocations`. It turns the
 * free-text suburbs Moving Sales used to store into the canonical
 * `formatLocation()` string, and REPORTS anything ambiguous instead of guessing
 * a location the seller never chose.
 */
const rows = [
  { locality: "RICHMOND", state: "VIC", postcode: "3121" },
  { locality: "RICHMOND", state: "NSW", postcode: "2753" },
  { locality: "RICHMOND", state: "QLD", postcode: "4740" },
  { locality: "RICHMOND", state: "QLD", postcode: "4822" },
  { locality: "CARLTON", state: "VIC", postcode: "3053" },
];
const byLocality = new Map<string, typeof rows>();
for (const r of rows) {
  const bucket = byLocality.get(r.locality);
  if (bucket) bucket.push(r);
  else byLocality.set(r.locality, [r]);
}
const resolve = (suburb: string) => resolveSuburb(byLocality, suburb);

describe("resolveSuburb", () => {
  test("a locality unique in the dataset resolves without a state", () => {
    expect(resolve("Carlton")).toBe("CARLTON, VIC 3053");
    expect(resolve("Carlton, VIC")).toBe("CARLTON, VIC 3053");
  });

  test("a state narrows a locality that exists in several", () => {
    expect(resolve("Richmond, VIC")).toBe("RICHMOND, VIC 3121");
    expect(resolve("Richmond NSW")).toBe("RICHMOND, NSW 2753");
  });

  test("a postcode narrows further", () => {
    expect(resolve("Richmond, QLD 4822")).toBe("RICHMOND, QLD 4822");
  });

  test("ambiguous or unknown input is reported, never guessed", () => {
    expect(resolve("Richmond")).toBeNull(); // three states
    expect(resolve("Richmond, QLD")).toBeNull(); // two postcodes
    expect(resolve("Nowhereville, VIC")).toBeNull();
    expect(resolve("  ")).toBeNull();
  });
});

describe("applySaleLocations dryRun", () => {
  /**
   * A dry run that under-reports is worse than no dry run — "0 would change"
   * reads as "nothing to do". This caught a real bug: the caller skipped the
   * mutation entirely on dryRun, so both counters stayed 0 while a real run
   * changed 9 rows.
   */
  const seed = async (t: ReturnType<typeof convexTest>) =>
    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", { isAnonymous: false });
      const categoryId = await ctx.db.insert("categories", {
        name: "Furniture", slug: "furniture", icon: "chair",
      });
      const now = Date.now();
      const saleEventId = await ctx.db.insert("saleEvents", {
        userId, title: "Move out", suburb: "Richmond, VIC", slug: "move-out",
        pickupWindowStart: now, pickupWindowEnd: now + 1, status: "active",
        createdAt: now, bumpedAt: now,
      });
      for (const title of ["Desk", "Chair"]) {
        await ctx.db.insert("ads", {
          title, description: "", location: "Richmond, VIC", categoryId, userId,
          images: [], isActive: true, views: 0, bumpedAt: now, saleEventId,
        });
      }
      return { saleEventId };
    });

  test("counts exactly what a real run would change, and writes nothing", async () => {
    const t = convexTest(schema, modules);
    const { saleEventId } = await seed(t);
    const updates = [{ saleEventId, location: "RICHMOND, VIC 3121" }];

    const dry = await t.mutation(internal.migrations.applySaleLocations, { updates, dryRun: true });
    expect(dry).toEqual({ salesPatched: 1, adsPatched: 2 });

    // Nothing written.
    await t.run(async (ctx) => {
      expect((await ctx.db.get(saleEventId))!.suburb).toBe("Richmond, VIC");
    });

    // A real run changes exactly what the dry run promised.
    const real = await t.mutation(internal.migrations.applySaleLocations, { updates });
    expect(real).toEqual(dry);
    await t.run(async (ctx) => {
      expect((await ctx.db.get(saleEventId))!.suburb).toBe("RICHMOND, VIC 3121");
    });
  });
});
