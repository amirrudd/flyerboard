/**
 * Rate-limit configuration DATA — frontend-safe (no Convex server imports).
 *
 * `convex/lib/rateLimit.ts` (the enforcement code) imports `_generated/server`, so
 * the admin SettingsTab can't import it. The static limits table, the list of
 * admin-overridable operations, and the `appSettings` key helper live here instead,
 * importable by BOTH the server and the frontend.
 *
 * Override model: an appSettings row with key `rateLimitMax_<op>` overrides ONLY
 * `maxRequests` for that op (the window stays static — simpler mental model). The
 * override is clamped to [1, 4× the static default]. NO row is seeded per op —
 * a missing row means "use the static default" by design, keeping the settings
 * table sparse. Saving from the admin tab creates the row on demand.
 */

export interface RateLimitConfig {
    /** Maximum number of requests allowed in the window */
    maxRequests: number;
    /** Time window in milliseconds */
    windowMs: number;
}

/** Default rate limits per operation type */
export const RATE_LIMITS: Record<string, RateLimitConfig> = {
    // Flyer operations
    createAd: { maxRequests: 10, windowMs: 60 * 60 * 1000 }, // 10 per hour

    // Moving Sale Mode — sale events are heavier (bulk items + AI). Cap creation tightly.
    createSaleEvent: { maxRequests: 5, windowMs: 24 * 60 * 60 * 1000 }, // 5 per day
    addSaleItems: { maxRequests: 60, windowMs: 60 * 60 * 1000 },        // 60 item-creates per hour (a 100-item sale takes ~2 windows; see saleMaxItems)
    createBundle: { maxRequests: 20, windowMs: 60 * 60 * 1000 },        // 20 standalone bundles per hour
    updateAd: { maxRequests: 30, windowMs: 60 * 60 * 1000 }, // 30 per hour
    deleteAd: { maxRequests: 20, windowMs: 60 * 60 * 1000 }, // 20 per hour

    // Messaging
    sendMessage: { maxRequests: 60, windowMs: 60 * 1000 }, // 60 per minute
    createChat: { maxRequests: 20, windowMs: 60 * 60 * 1000 }, // 20 per hour

    // Reports
    createReport: { maxRequests: 5, windowMs: 60 * 60 * 1000 }, // 5 per hour

    // Support form
    supportRequest: { maxRequests: 3, windowMs: 24 * 60 * 60 * 1000 }, // 3 per day

    // Ratings
    submitRating: { maxRequests: 10, windowMs: 60 * 60 * 1000 }, // 10 per hour

    // Image uploads
    generateUploadUrl: { maxRequests: 50, windowMs: 60 * 60 * 1000 }, // 50 per hour

    // Boost ("push to top") — ABUSE BACKSTOP ONLY. The real, admin-configurable
    // per-user daily cap is enforced inside `boostAd` via `checkRateLimitDynamic`
    // (default 3/day, tunable 1–20 from the admin Settings tab). This static entry
    // defines the hard ceiling (20 = BOOST_DAILY_CAP_MAX) and the window; the
    // configurable cap is clamped to ≤ this ceiling, so a single rate-limit row per
    // boost enforces both without double-counting. See convex/posts.ts boostAd.
    boostAd: { maxRequests: 20, windowMs: 24 * 60 * 60 * 1000 }, // 20 per day (backstop)

    // Default for unspecified operations
    default: { maxRequests: 100, windowMs: 60 * 1000 }, // 100 per minute
};

/**
 * Operations whose `maxRequests` can be overridden from Admin > Settings.
 * `boostAd` is deliberately EXCLUDED — it's the static abuse backstop behind the
 * already-configurable boost daily cap (see the comment on its entry above).
 * `default` is excluded because it's not a real operation.
 */
export const OVERRIDABLE_RATE_LIMIT_OPS = Object.keys(RATE_LIMITS).filter(
    (op) => op !== "boostAd" && op !== "default"
);

/** Override ceiling: an admin can raise a limit to at most 4× its static default. */
export const RATE_LIMIT_OVERRIDE_MAX_MULTIPLIER = 4;

/** Human-readable window noun ("minute" / "hour" / "day") for a static window. */
export function rateLimitWindowNoun(windowMs: number): string {
    if (windowMs === 60 * 1000) return "minute";
    if (windowMs === 60 * 60 * 1000) return "hour";
    if (windowMs === 24 * 60 * 60 * 1000) return "day";
    return `${Math.round(windowMs / 60000)} minutes`;
}

/**
 * Display metadata for the admin Settings tab — plain product language per op.
 * Windows are static (see RATE_LIMITS above), so each description spells the
 * window out; if you ever change a window, update the description beside it.
 */
export interface RateLimitOpMeta {
    /** Human label, e.g. "Start new chats". */
    label: string;
    /** One-sentence plain-English description with the window spelled out. */
    description: string;
    /** Noun for the input suffix, e.g. "chats" → "chats per user / hour". */
    noun: string;
}

export const RATE_LIMIT_OP_META: Record<string, RateLimitOpMeta> = {
    createAd: {
        label: "Post new flyers",
        description: "How many flyers one user can post per hour.",
        noun: "flyers",
    },
    createSaleEvent: {
        label: "Create moving sales",
        description: "How many Moving Sales one user can create per day.",
        noun: "sales",
    },
    addSaleItems: {
        label: "Add sale items",
        description: "How many items one user can add to their Moving Sales per hour.",
        noun: "items",
    },
    createBundle: {
        label: "Create bundles",
        description: "How many bundles one user can create per hour.",
        noun: "bundles",
    },
    updateAd: {
        label: "Edit flyers",
        description: "How many times one user can edit their flyers per hour.",
        noun: "edits",
    },
    deleteAd: {
        label: "Delete flyers",
        description: "How many flyers one user can delete per hour.",
        noun: "deletions",
    },
    sendMessage: {
        label: "Send messages",
        description: "How many chat messages one user can send per minute.",
        noun: "messages",
    },
    createChat: {
        label: "Start new chats",
        description: "How many new conversations one user can start per hour.",
        noun: "chats",
    },
    createReport: {
        label: "Report a flyer",
        description: "How many flyers one user can report per hour.",
        noun: "reports",
    },
    supportRequest: {
        label: "Support requests",
        description: "How many support form requests one user can send per day.",
        noun: "requests",
    },
    submitRating: {
        label: "Leave ratings",
        description: "How many ratings one user can leave per hour.",
        noun: "ratings",
    },
    generateUploadUrl: {
        label: "Image uploads",
        description: "How many images one user can upload per hour.",
        noun: "uploads",
    },
};

/** appSettings key for an op's maxRequests override. */
export function rateLimitSettingKey(op: string): string {
    return `rateLimitMax_${op}`;
}
