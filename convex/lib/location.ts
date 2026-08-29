import { v, type Infer } from "convex/values";

/**
 * The record behind a stored location string.
 *
 * `ads.location` is free text ("RICHMOND, VIC 3121") and, until now, was the only
 * location data kept. A suburb NAME is not a usable key — the shipped dataset has
 * 726 duplicated locality+state pairs and names repeat across states — so the
 * picker's own row id is stored alongside it.
 *
 * Nothing reads these fields yet: every filter still compares the location STRING
 * exactly as before, and this shipped with zero user-visible change. The point is
 * to stop discarding data the picker already had.
 *
 * Mirrors `LocationMeta` in `src/lib/locationService.ts`.
 */
export const locationMetaValidator = v.object({
  /** `id` from `public/australian-postcodes.json` — unique across all 18,559 rows. */
  localityId: v.optional(v.number()),
  latitude: v.optional(v.number()),
  longitude: v.optional(v.number()),
  /** ABS Statistical Area Level 4 (ASGS 2021), e.g. "206". */
  sa4Code: v.optional(v.string()),
  /**
   * "picked" — chosen from the dataset, so `localityId` is present.
   * "unresolved" — free text with nothing behind it (the picker's degraded path,
   * or a legacy row the backfill could not match). Coordinates are then ABSENT,
   * never a placeholder: a wrong coordinate is indistinguishable from a right one
   * forever after, so publishing succeeds with no point rather than a fake one.
   */
  locationSource: v.union(v.literal("picked"), v.literal("unresolved")),
});

export type LocationMeta = Infer<typeof locationMetaValidator>;

/** Mutation-arg form. Absent = "I have nothing to say about this location". */
export const optionalLocationMeta = v.optional(locationMetaValidator);

/**
 * The flat `ads` columns for one location record. Every key is present so that
 * spreading this into `ctx.db.patch` CLEARS stale values — an ad moved to a new
 * suburb by a client that sent no record must not keep the old suburb's
 * coordinates.
 */
export const adLocationFields = (meta?: LocationMeta) => ({
  localityId: meta?.localityId,
  latitude: meta?.latitude,
  longitude: meta?.longitude,
  sa4Code: meta?.sa4Code,
  locationSource: meta?.locationSource,
});
