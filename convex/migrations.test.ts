// @vitest-environment edge-runtime
import { expect, test, describe } from "vitest";
import { resolveSuburb } from "./migrations";

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
