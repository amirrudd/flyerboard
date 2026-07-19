/**
 * Registry of ALL admin-tunable numeric settings (appSettings table) — frontend-safe
 * (no Convex server imports), importable by both Convex functions and `src/`.
 *
 * One entry per setting: key, default (used when the row is missing), min/max
 * (clamped on read, rejected on write), description (used by seedAppSettings and by
 * `updateSetting`'s on-demand insert), and `seed` (whether `migrations:seedAppSettings`
 * creates the row). Rate-limit overrides are `seed: false` on purpose — a missing row
 * means "use the static default", keeping the table sparse (one potential row per op,
 * created only when an admin actually overrides it).
 *
 * Boost bounds stay defined in `convex/lib/boost.ts` (their original home, with the
 * rationale comments); this registry references them so there's one source of truth.
 */

import {
    SETTING_BOOST_COOLDOWN_DAYS,
    SETTING_BOOST_DAILY_CAP,
    DEFAULT_BOOST_COOLDOWN_DAYS,
    DEFAULT_BOOST_DAILY_CAP,
    BOOST_COOLDOWN_DAYS_MIN,
    BOOST_COOLDOWN_DAYS_MAX,
    BOOST_DAILY_CAP_MIN,
    BOOST_DAILY_CAP_MAX,
} from "./boost";
import {
    RATE_LIMITS,
    OVERRIDABLE_RATE_LIMIT_OPS,
    RATE_LIMIT_OVERRIDE_MAX_MULTIPLIER,
    rateLimitSettingKey,
} from "./rateLimitConfig";

// ── Setting keys ─────────────────────────────────────────────────────────────────
export const SETTING_BUNDLE_MAX_ITEMS = "bundleMaxItems";
export const SETTING_SALE_MAX_ITEMS = "saleMaxItems";
export const SETTING_SALE_EXPIRY_BUFFER_DAYS = "saleExpiryBufferDays";
export const SETTING_FEED_SALE_MEMBER_CAP = "feedSaleMemberCap";
export const SETTING_FEED_BUNDLE_MEMBER_CAP = "feedBundleMemberCap";

// ── Defaults (used when the appSettings row is missing) ──────────────────────────
export const DEFAULT_BUNDLE_MAX_ITEMS = 4;
export const DEFAULT_SALE_MAX_ITEMS = 100;
export const DEFAULT_SALE_EXPIRY_BUFFER_DAYS = 2;
export const DEFAULT_FEED_SALE_MEMBER_CAP = 3;
export const DEFAULT_FEED_BUNDLE_MEMBER_CAP = 2;

export interface AppSettingSpec {
    key: string;
    defaultValue: number;
    min: number;
    max: number;
    description: string;
    /** Whether migrations:seedAppSettings creates this row. */
    seed: boolean;
}

const SEEDED_SPECS: AppSettingSpec[] = [
    {
        key: SETTING_BOOST_COOLDOWN_DAYS,
        defaultValue: DEFAULT_BOOST_COOLDOWN_DAYS,
        min: BOOST_COOLDOWN_DAYS_MIN,
        max: BOOST_COOLDOWN_DAYS_MAX,
        description:
            "Days an ad's owner must wait between boosts (since listing or last boost). Admin-tunable 1–30. Drives the client countdown and the server cooldown check.",
        seed: true,
    },
    {
        key: SETTING_BOOST_DAILY_CAP,
        defaultValue: DEFAULT_BOOST_DAILY_CAP,
        min: BOOST_DAILY_CAP_MIN,
        max: BOOST_DAILY_CAP_MAX,
        description:
            "Max boosts one user may perform per rolling 24h window (anti-flooding). Admin-tunable 1–20; hard backstop ceiling is 20.",
        seed: true,
    },
    {
        key: SETTING_BUNDLE_MAX_ITEMS,
        defaultValue: DEFAULT_BUNDLE_MAX_ITEMS,
        min: 2,
        max: 10,
        description:
            "Max ads in one standalone bundle. Admin-tunable 2–10. Enforced server-side in createBundle; the /sell/bundle picker reads the same value.",
        seed: true,
    },
    {
        key: SETTING_SALE_MAX_ITEMS,
        defaultValue: DEFAULT_SALE_MAX_ITEMS,
        min: 10,
        max: 500,
        description:
            "Abuse ceiling: max items one Moving Sale can hold. Admin-tunable 10–500. Enforced server-side in addSaleItems.",
        seed: true,
    },
    {
        key: SETTING_SALE_EXPIRY_BUFFER_DAYS,
        defaultValue: DEFAULT_SALE_EXPIRY_BUFFER_DAYS,
        min: 0,
        max: 14,
        description:
            "Days a published sale page stays up past the end of its pickup window. Admin-tunable 0–14. Applied when the sale is published.",
        seed: true,
    },
    {
        key: SETTING_FEED_SALE_MEMBER_CAP,
        defaultValue: DEFAULT_FEED_SALE_MEMBER_CAP,
        min: 0,
        max: 10,
        description:
            "Max individual items of one Moving Sale shown in the home feed (the sale's composite card is always shown). Admin-tunable 0–10.",
        seed: true,
    },
    {
        key: SETTING_FEED_BUNDLE_MEMBER_CAP,
        defaultValue: DEFAULT_FEED_BUNDLE_MEMBER_CAP,
        min: 0,
        max: 10,
        description:
            "Max member ads of one Bundle shown in the home feed (the bundle's composite card is always shown). Admin-tunable 0–10.",
        seed: true,
    },
];

// Rate-limit overrides: one spec per overridable op, clamped to [1, 4× static default].
// seed: false — the sparse-row convention (missing row = static default).
const RATE_LIMIT_SPECS: AppSettingSpec[] = OVERRIDABLE_RATE_LIMIT_OPS.map((op) => {
    const staticDefault = RATE_LIMITS[op].maxRequests;
    return {
        key: rateLimitSettingKey(op),
        defaultValue: staticDefault,
        min: 1,
        max: staticDefault * RATE_LIMIT_OVERRIDE_MAX_MULTIPLIER,
        description: `Rate limit override for "${op}": max requests per window (static default ${staticDefault}). Admin-tunable 1–${staticDefault * RATE_LIMIT_OVERRIDE_MAX_MULTIPLIER}. Delete-proof: missing row = static default.`,
        seed: false,
    };
});

export const APP_SETTING_SPECS: AppSettingSpec[] = [...SEEDED_SPECS, ...RATE_LIMIT_SPECS];

const SPECS_BY_KEY = new Map(APP_SETTING_SPECS.map((s) => [s.key, s]));

export function getAppSettingSpec(key: string): AppSettingSpec | undefined {
    return SPECS_BY_KEY.get(key);
}

/**
 * Clamp a stored value for a KNOWN setting key into its valid range (non-finite
 * falls back to the default); unknown keys pass through untouched. Used on read
 * (getSetting, server-side consumers) as defense-in-depth against a raw
 * out-of-range value landing in the DB.
 */
export function clampAppSetting(key: string, value: number): number {
    const spec = SPECS_BY_KEY.get(key);
    if (!spec) return value;
    const n = Math.floor(value);
    if (!Number.isFinite(n)) return spec.defaultValue;
    return Math.min(spec.max, Math.max(spec.min, n));
}

/**
 * Whether a value is within the accepted range for a KNOWN setting key. Used by
 * `updateSetting` to REJECT out-of-range writes loudly (better admin feedback than
 * a silent clamp). Unknown keys are always considered valid here.
 */
export function isAppSettingInRange(key: string, value: number): boolean {
    const spec = SPECS_BY_KEY.get(key);
    if (!spec) return true;
    // All registered settings are integer counts/days — reject floats so the
    // stored value never drifts from what the server's clamp (which floors) enforces.
    return Number.isInteger(value) && value >= spec.min && value <= spec.max;
}
