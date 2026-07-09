/**
 * Boost ("push to top") shared constants + config helpers.
 *
 * This module is importable by BOTH Convex functions and the `src/` frontend (the
 * frontend may import from `convex/`, never the reverse). It carries NO Convex
 * server imports on purpose — pulling `_generated/server` in here would drag backend
 * code into the client bundle. So the DB read lives in `convex/appSettings.ts`; this
 * file only holds the pure constants, bounds, and clamps both sides share.
 *
 * `bumpedAt` is the mutable feed sort key on the `ads` table. A boost re-stamps it
 * to `Date.now()`, but only after the cooldown has elapsed since listing (or since
 * the last boost). The cooldown length and the per-user daily cap are now
 * admin-tunable via the `appSettings` table (keys below); the constants here are the
 * DEFAULTS used when a key is missing, and the bounds used to clamp on read AND write
 * so a bad/absent config value can never break the feed or open a flooding hole.
 */

// ── appSettings keys (numeric config store, see convex/appSettings.ts) ──────────
export const SETTING_BOOST_COOLDOWN_DAYS = "boostCooldownDays";
export const SETTING_BOOST_DAILY_CAP = "boostDailyCap";

// ── Feature flag gate (see convex/featureFlags.ts) ──────────────────────────────
export const FLAG_BOOST_TO_TOP = "boostToTop";

// ── Defaults (used when the appSettings key is absent) ──────────────────────────
export const DEFAULT_BOOST_COOLDOWN_DAYS = 7;
export const DEFAULT_BOOST_DAILY_CAP = 3;

// ── Bounds (clamped on read AND write) ──────────────────────────────────────────
// Cooldown 1–30 days; daily cap 1–20 boosts/user/day. The cap ceiling (20) is the
// same value as the static `RATE_LIMITS.boostAd` abuse backstop — clamping the
// configurable cap to ≤ 20 is what makes that backstop load-bearing without a second
// rate-limit row per boost (see convex/posts.ts boostAd + convex/lib/rateLimit.ts).
export const BOOST_COOLDOWN_DAYS_MIN = 1;
export const BOOST_COOLDOWN_DAYS_MAX = 30;
export const BOOST_DAILY_CAP_MIN = 1;
export const BOOST_DAILY_CAP_MAX = 20;

export const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Default cooldown in ms (7 days). Fallback for `boostAd` when the `boostCooldownDays`
 * setting is missing. Kept for backward-compat with Phase 1A imports.
 */
export const BOOST_COOLDOWN_MS = DEFAULT_BOOST_COOLDOWN_DAYS * MS_PER_DAY;

/** Default per-user daily cap (3). Fallback when the `boostDailyCap` setting is missing. */
export const BOOST_DAILY_CAP = DEFAULT_BOOST_DAILY_CAP;

function clampInt(value: number, min: number, max: number, fallback: number): number {
  const n = Math.floor(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** Clamp a cooldown-in-days value into [1, 30]; non-finite falls back to the default. */
export function clampCooldownDays(days: number): number {
  return clampInt(days, BOOST_COOLDOWN_DAYS_MIN, BOOST_COOLDOWN_DAYS_MAX, DEFAULT_BOOST_COOLDOWN_DAYS);
}

/** Clamp a daily-cap value into [1, 20]; non-finite falls back to the default. */
export function clampDailyCap(cap: number): number {
  return clampInt(cap, BOOST_DAILY_CAP_MIN, BOOST_DAILY_CAP_MAX, DEFAULT_BOOST_DAILY_CAP);
}

/**
 * Clamp a stored `appSettings` value for a KNOWN boost key; unknown keys pass through
 * untouched. Used on read (getSetting) so the client countdown and any consumer sees
 * the same bounded value the server enforces, even if a raw out-of-range value somehow
 * landed in the DB.
 */
export function clampBoostSetting(key: string, value: number): number {
  if (key === SETTING_BOOST_COOLDOWN_DAYS) return clampCooldownDays(value);
  if (key === SETTING_BOOST_DAILY_CAP) return clampDailyCap(value);
  return value;
}

/**
 * Whether a value is within the accepted range for a KNOWN boost key. Used by
 * `updateSetting` to REJECT out-of-range writes loudly (better admin feedback than a
 * silent clamp). Unknown keys are always considered valid here.
 */
export function isBoostSettingInRange(key: string, value: number): boolean {
  if (key === SETTING_BOOST_COOLDOWN_DAYS) {
    return Number.isFinite(value) && value >= BOOST_COOLDOWN_DAYS_MIN && value <= BOOST_COOLDOWN_DAYS_MAX;
  }
  if (key === SETTING_BOOST_DAILY_CAP) {
    return Number.isFinite(value) && value >= BOOST_DAILY_CAP_MIN && value <= BOOST_DAILY_CAP_MAX;
  }
  return true;
}
