import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { readSettingValue } from "../appSettings";
import { clampAppSetting, DEFAULT_NEAR_RADIUS_KM, SETTING_NEAR_RADIUS_KM } from "./appConfig";
import type { LocationMeta } from "./location";

/**
 * The near/far test behind the feed's two sections (rule 5,
 * `.agent/PRODUCT-RULES.md`). It answers ONE boolean, consumed by
 * `sectionFields` in `./cards.ts` — no distance, score or match reason leaves
 * this module, so nothing downstream can render or sort on one (rule 2).
 *
 * Before this, "near" meant the ad's location STRING equalled the buyer's, so
 * the suburb next door read as far away as another state. It now means:
 *
 *   same localityId  OR  within `nearRadiusKm`  OR  same SA4 region
 *
 * - **Identity first.** A large rural locality whose centroid sits far from the
 *   buyer still counts as near when it is literally the same suburb row.
 * - **The SA4 clause is the adaptive part.** A flat radius is wrong outside
 *   cities — Wagga's nearest real neighbours are 40–90 km away — and ABS SA4
 *   regions are small in metro and enormous in the bush, so one string
 *   comparison gives a radius that widens where it has to.
 * - **An unresolved listing has no coordinate and matches no clause**, so it
 *   sections as far. It is never hidden; far is a group, not a filter.
 */

/** What the test needs about the buyer: their picked suburb record + the radius. */
export type BuyerLocation = {
  /** The canonical `formatLocation()` string — display, and the legacy fallback below. */
  location: string;
  /**
   * The record captured AT THE PICK SITE. Absent for a buyer whose stored
   * preference predates the record (a cookie holding only the string), which is
   * the only reason the string fallback below still exists.
   *
   * It is never re-resolved from `location`: 24 locality+state+postcode groups
   * in the shipped dataset hold two rows with different ids and no shared
   * coordinates — O'CONNELL QLD 4680's two rows are 80 km apart — so looking a
   * stored string back up is a coin flip that can land this test 80 km out.
   */
  meta?: LocationMeta;
  radiusKm: number;
};

type Point = { lat: number; lng: number };

const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in km. */
export function haversineKm(a: Point, b: Point): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** The buyer's own point, or undefined when their record carries no coordinate. */
const buyerPoint = (meta: LocationMeta): Point | undefined =>
  meta.latitude !== undefined && meta.longitude !== undefined
    ? { lat: meta.latitude, lng: meta.longitude }
    : undefined;

/**
 * Read the admin-tuned radius and pair it with the buyer's record. Returns
 * `undefined` when no location is set — the default state, where the feed is
 * one continuous run and no entry is sectioned at all.
 */
export async function resolveBuyer(
  ctx: QueryCtx,
  location: string | undefined,
  meta: LocationMeta | undefined
): Promise<BuyerLocation | undefined> {
  if (!location) return undefined;
  const raw = await readSettingValue(ctx, SETTING_NEAR_RADIUS_KM);
  return {
    location,
    meta,
    radiusKm:
      raw === null ? DEFAULT_NEAR_RADIUS_KM : clampAppSetting(SETTING_NEAR_RADIUS_KM, raw),
  };
}

/** Is this ad near the buyer? */
export function isNearAd(buyer: BuyerLocation | undefined, ad: Doc<"ads">): boolean {
  if (!buyer) return false;
  const meta = buyer.meta;
  // No record behind the buyer's preference: the pre-Phase-4 test, unchanged.
  if (!meta) return ad.location === buyer.location;

  if (meta.localityId !== undefined && meta.localityId === ad.localityId) return true;
  const from = buyerPoint(meta);
  if (
    from &&
    ad.latitude !== undefined &&
    ad.longitude !== undefined &&
    haversineKm(from, { lat: ad.latitude, lng: ad.longitude }) <= buyer.radiusKm
  ) {
    return true;
  }
  return meta.sa4Code !== undefined && meta.sa4Code === ad.sa4Code;
}

/**
 * Is this Bundle / Moving Sale near the buyer? Near as soon as ANY member is —
 * the same any-member test category and search already use, because a card
 * inherits from its members (rule 1). Members are unordered sets, so each clause
 * is tested against its own derived array (they are positionally unrelated).
 */
export function isNearComposite(
  buyer: BuyerLocation | undefined,
  doc: Doc<"saleBundles"> | Doc<"saleEvents">
): boolean {
  if (!buyer) return false;
  const meta = buyer.meta;
  if (!meta) return (doc.locations ?? []).includes(buyer.location);

  if (meta.localityId !== undefined && (doc.localityIds ?? []).includes(meta.localityId)) {
    return true;
  }
  const from = buyerPoint(meta);
  // "Min distance over the members" — the nearest member decides, which `some`
  // expresses without computing a minimum nothing else would read.
  if (from && (doc.points ?? []).some((p) => haversineKm(from, p) <= buyer.radiusKm)) {
    return true;
  }
  return meta.sa4Code !== undefined && (doc.sa4Codes ?? []).includes(meta.sa4Code);
}
