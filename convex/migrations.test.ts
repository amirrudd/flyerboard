// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { expect, test, describe } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { internal } from "./_generated/api";
import { resolveSuburb, resolveLocationRow } from "./migrations";

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
  { locality: "RICHMOND", state: "VIC", postcode: "3121", id: 4719 },
  { locality: "RICHMOND", state: "NSW", postcode: "2753", id: 1500 },
  { locality: "RICHMOND", state: "QLD", postcode: "4740", id: 9001 },
  { locality: "RICHMOND", state: "QLD", postcode: "4822", id: 9002 },
  { locality: "CARLTON", state: "VIC", postcode: "3053", id: 4400 },
  // Two rows naming ONE place — 24 such groups exist in the shipped dataset.
  // `resolveSuburb` must still resolve them; `resolveLocationRow` must not.
  { locality: "HOBARTVILLE", state: "NSW", postcode: "2753", id: 5623 },
  { locality: "HOBARTVILLE", state: "NSW", postcode: "2753", id: 24269 },
];
const byLocality = new Map<string, typeof rows>();
for (const r of rows) {
  const bucket = byLocality.get(r.locality);
  if (bucket) bucket.push(r);
  else byLocality.set(r.locality, [r]);
}
const resolve = (suburb: string) => resolveSuburb(byLocality, suburb);

describe("resolveLocationRow — the record behind a stored location string", () => {
  // The shared matching logic is covered by the `resolveSuburb` suite below; these
  // cover only what differs — that a ROW comes back, and that it is stricter.
  test("a canonical stored string resolves back to its exact dataset row", () => {
    expect(resolveLocationRow(byLocality, "RICHMOND, VIC 3121")?.id).toBe(4719);
    expect(resolveLocationRow(byLocality, "RICHMOND, NSW 2753")?.id).toBe(1500);
  });

  test("two rows naming one place are one STRING but not one RECORD", () => {
    // resolveSuburb resolves this (below); the id would be a coin flip, and an id
    // the seller didn't pick is worse than no id.
    expect(resolveLocationRow(byLocality, "HOBARTVILLE, NSW 2753")).toBeNull();
  });
});

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

  test("two dataset rows naming ONE place still resolve (24 such groups exist)", () => {
    // Regression guard: distinctness here is by canonical STRING, not row id.
    expect(resolve("Hobartville, NSW 2753")).toBe("HOBARTVILLE, NSW 2753");
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

describe("backfillAdLocationRecords", () => {
  /**
   * The backfill resolves each ad's stored location STRING back to the dataset row
   * the picker originally used, and stamps the record that used to be discarded.
   * It must change nothing a user sees: `location` itself is never rewritten.
   */
  const DATASET = [
    { id: 4719, postcode: "3121", locality: "RICHMOND", state: "VIC", lat: -37.823303, long: 145.001788, sa4: "206" },
    { id: 1500, postcode: "2753", locality: "RICHMOND", state: "NSW", lat: -33.598, long: 150.751, sa4: "115" },
    { id: 4720, postcode: "3065", locality: "FITZROY", state: "VIC", lat: -37.8, long: 144.978, sa4: "206" },
  ];

  const seed = async (t: ReturnType<typeof convexTest>) =>
    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", { isAnonymous: false });
      const categoryId = await ctx.db.insert("categories", {
        name: "Furniture", slug: "furniture", icon: "chair",
      });
      const now = Date.now();
      const saleEventId = await ctx.db.insert("saleEvents", {
        userId, title: "Move out", suburb: "RICHMOND, VIC 3121", slug: "move-out",
        pickupWindowStart: now, pickupWindowEnd: now + 1, status: "active",
        createdAt: now, bumpedAt: now,
      });
      const mk = (title: string, location: string, extra = {}) =>
        ctx.db.insert("ads", {
          title, description: "", location, categoryId, userId,
          images: [], isActive: true, views: 0, bumpedAt: now, ...extra,
        });
      return {
        saleEventId,
        resolvable: await mk("Desk", "FITZROY, VIC 3065"),
        // Free text a seller typed while the dataset was down. Matches no row.
        freeText: await mk("Sofa", "Somewhere, Nowhere"),
        // "Richmond" alone is two real places — resolving it would stamp a suburb
        // the seller never chose.
        ambiguous: await mk("Lamp", "Richmond"),
        saleItem: await mk("Chair", "RICHMOND, VIC 3121", { saleEventId }),
      };
    });

  /** Serve the dataset over `fetch`, the way the action reads it in production. */
  const withDataset = async (fn: () => Promise<void>) => {
    const original = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(JSON.stringify(DATASET), {
        headers: { "content-type": "application/json" },
      });
    try {
      await fn();
    } finally {
      globalThis.fetch = original;
    }
  };

  test("a dry run counts exactly what a real run changes, and writes nothing", async () => {
    await withDataset(async () => {
      const t = convexTest(schema, modules);
      const ids = await seed(t);

      const dry = await t.action(internal.migrations.backfillAdLocationRecords, { dryRun: true });
      expect(dry.dryRun).toBe(true);
      expect(dry.adsScanned).toBe(4);
      expect(dry.adsPatched).toBe(4);
      expect(dry.salesStamped).toBe(1);
      expect(dry.coordinatesDropped).toBe(0); // none of the seeded rows had one
      expect(dry.unresolved).toEqual([
        { location: "Somewhere, Nowhere", count: 1 },
        { location: "Richmond", count: 1 },
      ]);

      await t.run(async (ctx) => {
        expect((await ctx.db.get(ids.resolvable))!.locationSource).toBeUndefined();
        expect((await ctx.db.get(ids.saleEventId))!.suburbMeta).toBeUndefined();
      });

      const real = await t.action(internal.migrations.backfillAdLocationRecords, {});
      expect(real.adsPatched).toBe(dry.adsPatched);
      expect(real.salesStamped).toBe(dry.salesStamped);
      expect(real.unresolved).toEqual(dry.unresolved);
    });
  });

  test("stamps the resolved record and leaves `location` itself untouched", async () => {
    await withDataset(async () => {
      const t = convexTest(schema, modules);
      const ids = await seed(t);
      await t.action(internal.migrations.backfillAdLocationRecords, {});

      await t.run(async (ctx) => {
        const ad = (await ctx.db.get(ids.resolvable))!;
        expect(ad.location).toBe("FITZROY, VIC 3065"); // unchanged — zero user-visible change
        expect(ad.localityId).toBe(4720);
        expect(ad.latitude).toBe(-37.8);
        expect(ad.longitude).toBe(144.978);
        expect(ad.sa4Code).toBe("206");
        expect(ad.locationSource).toBe("picked");

        expect((await ctx.db.get(ids.saleEventId))!.suburbMeta).toEqual({
          localityId: 4719, latitude: -37.823303, longitude: 145.001788,
          sa4Code: "206", locationSource: "picked",
        });
      });
    });
  });

  test("an unmatched or ambiguous location gets NO coordinates, never a placeholder", async () => {
    await withDataset(async () => {
      const t = convexTest(schema, modules);
      const ids = await seed(t);
      await t.action(internal.migrations.backfillAdLocationRecords, {});

      await t.run(async (ctx) => {
        for (const id of [ids.freeText, ids.ambiguous]) {
          const ad = (await ctx.db.get(id))!;
          expect(ad.locationSource).toBe("unresolved");
          expect(ad.localityId).toBeUndefined();
          // The whole point: a wrong coordinate is indistinguishable from a right
          // one forever after, so there is no fallback point of any kind.
          expect(ad.latitude).toBeUndefined();
          expect(ad.longitude).toBeUndefined();
          expect(ad.sa4Code).toBeUndefined();
        }
      });
    });
  });

  test("the sale card inherits its members' records (rule 1)", async () => {
    await withDataset(async () => {
      const t = convexTest(schema, modules);
      const ids = await seed(t);
      await t.action(internal.migrations.backfillAdLocationRecords, {});

      await t.run(async (ctx) => {
        const sale = (await ctx.db.get(ids.saleEventId))!;
        expect(sale.localityIds).toEqual([4719]);
        expect(sale.points).toEqual([{ lat: -37.823303, lng: 145.001788 }]);
        expect(sale.sa4Codes).toEqual(["206"]);
      });
    });
  });

  test("re-running changes nothing — already-stamped rows are skipped", async () => {
    await withDataset(async () => {
      const t = convexTest(schema, modules);
      await seed(t);
      await t.action(internal.migrations.backfillAdLocationRecords, {});
      const second = await t.action(internal.migrations.backfillAdLocationRecords, {});
      expect(second.adsScanned).toBe(0);
      expect(second.adsPatched).toBe(0);
      expect(second.salesStamped).toBe(0);
    });
  });
});
