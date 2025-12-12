import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireAdmin } from "./lib/adminAuth";

// ============================================================================
// PUBLIC QUERIES
// ============================================================================

/**
 * Get all categories with hierarchical structure
 */
export const getCategories = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("categories").collect();
  },
});

/**
 * Get category by slug
 */
export const getCategoryBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("categories")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
  },
});

/**
 * Get category by ID
 */
export const getCategoryById = query({
  args: { categoryId: v.id("categories") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.categoryId);
  },
});

/**
 * Get subcategories for a parent category
 */
export const getSubcategories = query({
  args: { parentId: v.id("categories") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("categories")
      .withIndex("by_parent", (q) => q.eq("parentId", args.parentId))
      .collect();
  },
});

// ============================================================================
// ADMIN MUTATIONS
// ============================================================================

/**
 * Create a new category (admin only)
 */
export const createCategory = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    icon: v.optional(v.string()),
    parentId: v.optional(v.id("categories")),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    // Validate name
    if (!args.name || args.name.trim().length === 0) {
      throw new Error("Category name is required");
    }
    if (args.name.length > 50) {
      throw new Error("Category name must be 50 characters or less");
    }

    // Validate and normalize slug
    const slug = args.slug.toLowerCase().trim();
    if (!/^[a-z0-9-]+$/.test(slug)) {
      throw new Error("Slug must contain only lowercase letters, numbers, and hyphens");
    }

    // Check slug uniqueness
    const existingCategory = await ctx.db
      .query("categories")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();

    if (existingCategory) {
      throw new Error(`Category with slug "${slug}" already exists`);
    }

    // Validate parent category exists if provided
    if (args.parentId) {
      const parentCategory = await ctx.db.get(args.parentId);
      if (!parentCategory) {
        throw new Error("Parent category not found");
      }

      // Prevent circular references - check if parent has this as ancestor
      // (For now, we only allow one level of nesting to keep it simple)
      if (parentCategory.parentId) {
        throw new Error("Cannot create subcategory of a subcategory. Only one level of nesting is supported.");
      }
    }

    const categoryId = await ctx.db.insert("categories", {
      name: args.name.trim(),
      slug,
      icon: args.icon,
      parentId: args.parentId,
    });

    return { success: true, categoryId };
  },
});

/**
 * Update an existing category (admin only)
 */
export const updateCategory = mutation({
  args: {
    categoryId: v.id("categories"),
    name: v.optional(v.string()),
    slug: v.optional(v.string()),
    icon: v.optional(v.string()),
    parentId: v.optional(v.id("categories")),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const category = await ctx.db.get(args.categoryId);
    if (!category) {
      throw new Error("Category not found");
    }

    const updates: any = {};

    // Validate and update name
    if (args.name !== undefined) {
      if (!args.name || args.name.trim().length === 0) {
        throw new Error("Category name is required");
      }
      if (args.name.length > 50) {
        throw new Error("Category name must be 50 characters or less");
      }
      updates.name = args.name.trim();
    }

    // Validate and update slug
    if (args.slug !== undefined) {
      const slug = args.slug.toLowerCase().trim();
      if (!/^[a-z0-9-]+$/.test(slug)) {
        throw new Error("Slug must contain only lowercase letters, numbers, and hyphens");
      }

      // Check slug uniqueness (excluding current category)
      const existingCategory = await ctx.db
        .query("categories")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .first();

      if (existingCategory && existingCategory._id !== args.categoryId) {
        throw new Error(`Category with slug "${slug}" already exists`);
      }

      updates.slug = slug;
    }

    // Update icon
    if (args.icon !== undefined) {
      updates.icon = args.icon;
    }

    // Validate and update parent
    if (args.parentId !== undefined) {
      if (args.parentId === args.categoryId) {
        throw new Error("Category cannot be its own parent");
      }

      if (args.parentId) {
        const parentCategory = await ctx.db.get(args.parentId);
        if (!parentCategory) {
          throw new Error("Parent category not found");
        }

        // Prevent circular references
        if (parentCategory.parentId) {
          throw new Error("Cannot create subcategory of a subcategory. Only one level of nesting is supported.");
        }

        // Check if this category has children - if so, can't make it a subcategory
        const children = await ctx.db
          .query("categories")
          .withIndex("by_parent", (q) => q.eq("parentId", args.categoryId))
          .first();

        if (children) {
          throw new Error("Cannot make a parent category into a subcategory. Remove its children first.");
        }
      }

      updates.parentId = args.parentId;
    }

    await ctx.db.patch(args.categoryId, updates);

    return { success: true };
  },
});

/**
 * Delete a category (admin only)
 */
export const deleteCategory = mutation({
  args: {
    categoryId: v.id("categories"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const category = await ctx.db.get(args.categoryId);
    if (!category) {
      throw new Error("Category not found");
    }

    // Check if category has subcategories
    const subcategories = await ctx.db
      .query("categories")
      .withIndex("by_parent", (q) => q.eq("parentId", args.categoryId))
      .first();

    if (subcategories) {
      throw new Error("Cannot delete category with subcategories. Delete or reassign subcategories first.");
    }

    // Check if category is used by any ads
    const adsWithCategory = await ctx.db
      .query("ads")
      .withIndex("by_category", (q) => q.eq("categoryId", args.categoryId))
      .first();

    if (adsWithCategory) {
      throw new Error("Cannot delete category that is used by existing ads. Reassign or delete those ads first.");
    }

    await ctx.db.delete(args.categoryId);

    return { success: true };
  },
});

// ============================================================================
// LEGACY MUTATION (Keep for backward compatibility)
// ============================================================================

/**
 * @deprecated Use admin category management mutations instead
 */
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
