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
};

// Extend the auth tables to add custom fields
const schema = defineSchema({
  ...authTables,
  ...applicationTables,
});

// Extend users table with custom fields
export default schema.tables.users
  ? defineSchema({
    ...schema.tables,
    users: defineTable({
      ...schema.tables.users.validator.fields,
      image: v.optional(v.string()),
    }).index("email", ["email"]),
  })
  : schema;
