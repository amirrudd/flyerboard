import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {
  categories: defineTable({
    name: v.string(),
    slug: v.string(),
    icon: v.optional(v.string()),        // Icon name or emoji for category
    parentId: v.optional(v.id("categories")),
  })
    .index("by_slug", ["slug"])
    .index("by_parent", ["parentId"]),

  ads: defineTable({
    title: v.string(),
    description: v.string(),
    listingType: v.optional(v.union(v.literal("sale"), v.literal("exchange"), v.literal("both"))), // Optional for backward compatibility, defaults to "sale"
    price: v.optional(v.number()), // Optional - required only for "sale" or "both" listing types
    previousPrice: v.optional(v.number()), // Previous price for showing price reductions
    exchangeDescription: v.optional(v.string()), // What the user is looking for in exchange
    location: v.string(),
    categoryId: v.id("categories"),
    images: v.array(v.string()),
    userId: v.id("users"),
    isActive: v.boolean(),
    isDeleted: v.optional(v.boolean()), // Logical delete flag
    views: v.number(),

    // Moving Sale Mode: an ad can belong to a sale event.
    saleEventId: v.optional(v.id("saleEvents")), // FK → saleEvents (null for regular ads)
    isSold: v.optional(v.boolean()),             // Sold marker — NOT isDeleted; sold items stay visible (greyed) on the sale page
    bundleId: v.optional(v.id("saleBundles")),   // Optional FK → saleBundles
    condition: v.optional(v.string()),           // e.g. "New", "Like new", "Good", "Fair" — surfaced in batch review

    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
  })
    .index("by_category", ["categoryId"])
    .index("by_location", ["location"])
    .index("by_active", ["isActive"])
    .index("by_user", ["userId"])
    .index("by_deleted", ["isDeleted"])
    .index("by_sale_event", ["saleEventId"])
    .searchIndex("search_ads", {
      searchField: "title",
      filterFields: ["categoryId", "location", "isActive", "isDeleted"],
    }),

  chats: defineTable({
    // Exactly one of adId / saleEventId is set (enforced in mutations, not the validator).
    adId: v.optional(v.id("ads")),               // single-listing thread (null for Sale threads)
    saleEventId: v.optional(v.id("saleEvents")), // Sale thread — one per buyer per Sale (v2)
    buyerId: v.id("users"),
    sellerId: v.id("users"),
    lastMessageAt: v.number(),
    lastReadBySeller: v.optional(v.number()),
    lastReadByBuyer: v.optional(v.number()),
    archivedByBuyer: v.optional(v.boolean()),
    archivedBySeller: v.optional(v.boolean()),
  })
    .index("by_ad_and_buyer", ["adId", "buyerId"])
    .index("by_sale_event_buyer", ["saleEventId", "buyerId"]) // 1 thread per buyer per Sale
    .index("by_buyer", ["buyerId"])
    .index("by_seller", ["sellerId"])
    .index("by_ad", ["adId"])
    .index("by_buyer_archived", ["buyerId", "archivedByBuyer"])
    .index("by_seller_archived", ["sellerId", "archivedBySeller"]),

  messages: defineTable({
    chatId: v.id("chats"),
    senderId: v.id("users"),
    content: v.string(),
    timestamp: v.number(),
    referencedAdIds: v.optional(v.array(v.id("ads"))), // sale-item chips referenced in this message (v2)
  })
    .index("by_chat", ["chatId"])
    .index("by_timestamp", ["timestamp"]),

  savedAds: defineTable({
    userId: v.id("users"),
    adId: v.id("ads"),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_ad", ["userId", "adId"]),

  /** Bookmarking a whole Sale (not its individual items) — mirrors savedAds. */
  savedSaleEvents: defineTable({
    userId: v.id("users"),
    saleEventId: v.id("saleEvents"),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_sale", ["userId", "saleEventId"]),

  reports: defineTable({
    reporterId: v.id("users"),          // User submitting the report
    reportType: v.string(),              // "ad", "profile", or "chat"
    reportedEntityId: v.string(),        // ID of the reported item (ad, user, or chat)
    reason: v.string(),                  // Report reason category
    description: v.optional(v.string()), // Optional detailed description
    status: v.string(),                  // "pending", "reviewed", "resolved"
    createdAt: v.number(),               // Timestamp
  })
    .index("by_reporter", ["reporterId"])
    .index("by_entity", ["reportedEntityId"])
    .index("by_status", ["status"])
    .index("by_type", ["reportType"]),

  ratings: defineTable({
    raterId: v.id("users"),              // User who submitted the rating
    ratedUserId: v.id("users"),          // User being rated
    rating: v.number(),                  // Rating value (0-5, supports 0.5 increments)
    chatId: v.optional(v.id("chats")),   // Optional reference to chat context
    comment: v.optional(v.string()),     // Optional text feedback
    createdAt: v.number(),               // Timestamp
  })
    .index("by_rater", ["raterId"])
    .index("by_rated_user", ["ratedUserId"])
    .index("by_rater_and_rated", ["raterId", "ratedUserId"])
    .index("by_chat", ["chatId"]),

  uploads: defineTable({
    key: v.string(),                     // R2 object key
    userId: v.id("users"),               // User who uploaded
    bucket: v.string(),                  // R2 bucket name
    contentType: v.optional(v.string()), // MIME type
    size: v.optional(v.number()),        // File size in bytes
    uploadedAt: v.number(),              // Timestamp
    associatedWith: v.optional(v.string()), // "ad:id" or "profile:id" for tracking
  })
    .index("by_user", ["userId"])
    .index("by_key", ["key"])
    .index("by_uploaded_at", ["uploadedAt"]),

  pushSubscriptions: defineTable({
    userId: v.id("users"),               // User who owns this subscription
    endpoint: v.string(),                // Push service endpoint URL
    keys: v.object({
      p256dh: v.string(),                // Public key for encryption
      auth: v.string(),                  // Authentication secret
    }),
    userAgent: v.optional(v.string()),   // Browser/device info
    createdAt: v.number(),               // When subscription was created
    lastUsed: v.optional(v.number()),    // Last successful notification sent
  })
    .index("by_user", ["userId"])
    .index("by_endpoint", ["endpoint"]),

  pendingEmailNotifications: defineTable({
    recipientId: v.id("users"),
    chatId: v.id("chats"),
    adId: v.id("ads"),
    senderId: v.id("users"),
    messageContent: v.string(),
    createdAt: v.number(),
  })
    .index("by_recipient", ["recipientId"])
    .index("by_recipient_chat", ["recipientId", "chatId"])
    .index("by_created_at", ["createdAt"]),

  featureFlags: defineTable({
    key: v.string(),           // Unique identifier (e.g., "identityVerification")
    enabled: v.boolean(),      // Whether the flag is enabled
    description: v.string(),   // Human-readable description
  })
    .index("by_key", ["key"]),

  // ──────────────────────────────────────────────────────────────────────────
  // Moving Sale Mode
  // A first-class "sale event" groups many ads into one shareable, time-boxed
  // sale with a public page, bundle pricing, and a pickup window.
  // ──────────────────────────────────────────────────────────────────────────
  saleEvents: defineTable({
    userId: v.id("users"),                 // Owner (seller)
    slug: v.optional(v.string()),          // Permanent public URL slug, e.g. "amirs-sale-richmond-k7p2". Minted at publish time, never regenerated (printed flyers encode it).
    title: v.string(),                     // "Amir's Moving Sale"
    suburb: v.string(),                    // Display-only, e.g. "Richmond, VIC"
    note: v.optional(v.string()),          // Optional note for buyers
    pickupWindowStart: v.number(),         // Timestamp
    pickupWindowEnd: v.number(),           // Timestamp
    status: v.union(
      v.literal("draft"),                  // Being built, not yet published
      v.literal("active"),                 // Published + live (free — no payment gate in v2)
      v.literal("ended")                   // Pickup window closed
    ),
    // v2 tier model: the mode is FREE. Publishing and the public page cost nothing.
    // Monetisation is à-la-carte add-ons tracked in `unlockedAddons`.
    unlockedAddons: v.optional(v.array(v.string())), // e.g. ["flyer","pin","ai"] — purchased upgrades (stubbed)
    pinnedUntil: v.optional(v.number()),   // 7-day search-pin add-on expiry
    itemCap: v.optional(v.number()),       // legacy/back-compat — no longer enforced (free = unlimited)
    isPaid: v.optional(v.boolean()),       // legacy/back-compat — no longer gates the page
    flyerPdfUrl: v.optional(v.string()),   // R2 key for cached printable flyer, null until first generated
    expiresAt: v.optional(v.number()),     // Auto-close target (after pickup window)
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_slug", ["slug"])
    .index("by_status", ["status"]),

  saleBundles: defineTable({
    saleEventId: v.id("saleEvents"),       // FK → saleEvents
    label: v.string(),                     // "Home office setup"
    bundlePrice: v.number(),               // Seller-set or AI-suggested bundle price
    adIds: v.array(v.id("ads")),           // Ads included in this bundle
  })
    .index("by_sale_event", ["saleEventId"]),
};

// Extend the auth tables to add custom fields
export default defineSchema({
  ...authTables,
  ...applicationTables,
  users: defineTable({
    ...authTables.users.validator.fields,
    tokenIdentifier: v.optional(v.string()), // Descope subject ID
    phone: v.optional(v.string()),           // Phone number for OTP users
    image: v.optional(v.string()),
    totalRating: v.optional(v.number()),      // Sum of all ratings received
    ratingCount: v.optional(v.number()),      // Number of ratings received
    averageRating: v.optional(v.number()),    // Average rating (totalRating / ratingCount)
    isVerified: v.optional(v.boolean()),      // Identity verification status
    isAdmin: v.optional(v.boolean()),         // Admin flag for admin access
    isActive: v.optional(v.boolean()),        // Account status (true = active, false = deactivated)
    emailNotificationsEnabled: v.optional(v.boolean()), // Opt-in for email notifications
  })
    .index("email", ["email"])
    .index("tokenIdentifier", ["tokenIdentifier"])
    .index("by_admin", ["isAdmin"])
    .index("by_active", ["isActive"]),
});
