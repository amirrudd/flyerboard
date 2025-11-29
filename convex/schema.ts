import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {
  categories: defineTable({
    name: v.string(),
    slug: v.string(),
    icon: v.optional(v.string()),
    parentId: v.optional(v.id("categories")),
  }).index("by_slug", ["slug"]),

  ads: defineTable({
    title: v.string(),
    description: v.string(),
    price: v.number(),
    location: v.string(),
    categoryId: v.id("categories"),
    images: v.array(v.string()),
    userId: v.id("users"),
    isActive: v.boolean(),
    isDeleted: v.optional(v.boolean()), // Logical delete flag
    views: v.number(),
    extendedDescription: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
  })
    .index("by_category", ["categoryId"])
    .index("by_location", ["location"])
    .index("by_active", ["isActive"])
    .index("by_user", ["userId"])
    .index("by_deleted", ["isDeleted"])
    .searchIndex("search_ads", {
      searchField: "title",
      filterFields: ["categoryId", "location", "isActive", "isDeleted"],
    }),

  chats: defineTable({
    adId: v.id("ads"),
    buyerId: v.id("users"),
    sellerId: v.id("users"),
    lastMessageAt: v.number(),
    lastReadBySeller: v.optional(v.number()),
    lastReadByBuyer: v.optional(v.number()),
    archivedByBuyer: v.optional(v.boolean()),
    archivedBySeller: v.optional(v.boolean()),
  })
    .index("by_ad_and_buyer", ["adId", "buyerId"])
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
  })
    .index("by_chat", ["chatId"])
    .index("by_timestamp", ["timestamp"]),

  savedAds: defineTable({
    userId: v.id("users"),
    adId: v.id("ads"),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_ad", ["userId", "adId"]),

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
};

// Extend the auth tables to add custom fields
export default defineSchema({
  ...authTables,
  ...applicationTables,
  users: defineTable({
    ...authTables.users.validator.fields,
    image: v.optional(v.string()),
    totalRating: v.optional(v.number()),      // Sum of all ratings received
    ratingCount: v.optional(v.number()),      // Number of ratings received
    averageRating: v.optional(v.number()),    // Average rating (totalRating / ratingCount)
    isVerified: v.optional(v.boolean()),      // Identity verification status
  }).index("email", ["email"]),
});
