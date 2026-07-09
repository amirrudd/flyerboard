/**
 * Boost ("push to top") shared constants.
 *
 * These are DEFAULTS. An admin-editable runtime config is planned for Phase 1B
 * and will override them at runtime (design incoming) — for Phase 1A they are the
 * single source of truth, importable by both Convex functions and `src/` (the
 * frontend may import from `convex/`, never the reverse) so the client countdown
 * can never drift from the server's cooldown check.
 *
 * `bumpedAt` is the mutable feed sort key on the `ads` table. A boost re-stamps it
 * to `Date.now()`, but only after `BOOST_COOLDOWN_MS` has elapsed since listing (or
 * since the last boost). `BOOST_DAILY_CAP` is the per-user anti-flooding gate,
 * enforced via `RATE_LIMITS.boostAd` in Phase 1B (a many-ad seller must not be able
 * to own the whole top of the feed).
 */

/** Minimum time between boosts of a single ad (7 days). Default — see docblock. */
export const BOOST_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

/** Max boosts one user may perform per rolling 24h window. Default — see docblock. */
export const BOOST_DAILY_CAP = 3;
