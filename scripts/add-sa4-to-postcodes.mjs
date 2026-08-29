#!/usr/bin/env node
/**
 * Stamp an `sa4` (ABS Statistical Area Level 4, ASGS 2021) code onto every row of
 * `public/australian-postcodes.json`.
 *
 * Why not take SA4 from the upstream dataset this file came from
 * (matthewproctor/australianpostcodes)? Its `SA4_CODE_2021` column is corrupt —
 * only 21 distinct values across 108 real SA4s, with Sydney CBD localities filed
 * under "Sydney - Sutherland". Its `SA2_CODE_2021` column (whose first three
 * digits ARE the SA4 code) disagrees with ABS geometry for ~16% of a random
 * sample, always on rural rows. Both were rejected.
 *
 * Instead every row's own `lat`/`long` is point-in-polygoned against the ABS
 * ASGS 2021 SA4 boundaries. That is authoritative, and — more importantly — it
 * is self-consistent with the coordinates we also store, so a region code can
 * never disagree with the point it was derived from.
 *
 * Rows sharing a coordinate share one lookup (18,559 rows → 4,807 queries).
 * A coordinate that lands in water (a harbour or bay centroid) is retried with a
 * growing buffer, smallest first, so the nearest region wins.
 *
 * Usage: node scripts/add-sa4-to-postcodes.mjs [--dry-run]
 */
import { readFile, writeFile, stat } from "node:fs/promises";

const DATASET = "public/australian-postcodes.json";
const SA4_LAYER =
  "https://geo.abs.gov.au/arcgis/rest/services/ASGS2021/SA4/MapServer/0/query";
const BUFFERS_M = [0, 100, 250, 500, 1000, 2000, 5000, 10_000, 50_000];
const CONCURRENCY = 12;

/** SA4 code containing (or nearest to) a point, or null if nothing within 50 km. */
async function sa4For(lat, lng) {
  for (const distance of BUFFERS_M) {
    const params = new URLSearchParams({
      geometry: `${lng},${lat}`,
      geometryType: "esriGeometryPoint",
      inSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      outFields: "sa4_code_2021",
      returnGeometry: "false",
      f: "json",
      ...(distance ? { distance: String(distance), units: "esriSRUnit_Meter" } : {}),
    });
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const res = await fetch(`${SA4_LAYER}?${params}`);
        const body = await res.json();
        const hit = body.features?.[0];
        if (hit) return hit.attributes.sa4_code_2021;
        break; // a clean "no features" — widen the buffer rather than retry
      } catch {
        /* transient — retry */
      }
    }
  }
  return null;
}

const rows = JSON.parse(await readFile(DATASET, "utf8"));
// (0, 0) is the dataset's own placeholder for "no coordinate", not the Gulf of
// Guinea. Six rows carry it; they resolve to no region, which is the honest answer.
const key = (r) => (r.lat && r.long ? `${r.lat},${r.long}` : null);
const coords = [...new Set(rows.map(key).filter(Boolean))];
console.log(`${rows.length} rows, ${coords.length} distinct coordinates`);

const found = new Map();
let done = 0;
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    for (let i = coords.shift(); i !== undefined; i = coords.shift()) {
      const [lat, lng] = i.split(",").map(Number);
      found.set(i, await sa4For(lat, lng));
      if (++done % 250 === 0) console.log(`  …${done}`);
    }
  })
);

let resolved = 0;
const unresolved = [];
for (const row of rows) {
  const sa4 = found.get(key(row));
  if (sa4) {
    row.sa4 = sa4;
    resolved++;
  } else {
    unresolved.push(row);
  }
}

console.log(`resolved ${resolved}/${rows.length} (${((resolved / rows.length) * 100).toFixed(2)}%)`);
for (const r of unresolved) console.log("  unresolved:", r.id, r.locality, r.state, r.postcode);

if (process.argv.includes("--dry-run")) process.exit(0);
const before = (await stat(DATASET)).size;
await writeFile(DATASET, JSON.stringify(rows));
const after = (await stat(DATASET)).size;
console.log(`${DATASET}: ${before} → ${after} bytes (+${after - before})`);
