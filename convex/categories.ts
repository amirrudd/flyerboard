import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const getCategories = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("categories").collect();
  },
});

export const updateCategories = mutation({
  args: {},
  handler: async (ctx) => {
    // Get all existing categories
    const existingCategories = await ctx.db.query("categories").collect();

    // Delete all existing categories
    for (const category of existingCategories) {
      await ctx.db.delete(category._id);
    }

    // Create updated categories with proper names and slugs
    const categories = [
      { name: "Vehicles", slug: "vehicles" },
      { name: "Real Estate", slug: "real-estate" },
      { name: "Electronics", slug: "electronics" },
      { name: "Home & Garden", slug: "home-garden" },
      { name: "Services", slug: "services" },
      { name: "Fashion", slug: "fashion" },
      { name: "Sports & Recreation", slug: "sports" },
      { name: "Jobs", slug: "jobs" },
      { name: "Personal Items", slug: "personal-items" },
      { name: "Books & Media", slug: "books-media" },
      { name: "Pets & Animals", slug: "pets-animals" },
    ];

    const categoryIds = [];
    for (const category of categories) {
      const id = await ctx.db.insert("categories", category);
      categoryIds.push(id);
    }

    return {
      success: true,
      message: "Categories updated successfully",
      categoriesCreated: categoryIds.length
    };
  },
});

export const getCategoryBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("categories")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
  },
});
