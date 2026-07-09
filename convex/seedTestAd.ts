import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Local-test helper: inserts an ad with off-ratio images to exercise grid
 * thumbnail aspect-ratio handling (the blurred-backdrop fill in AdsGrid).
 *
 * The primary image is a very tall portrait; the second is a very wide
 * landscape, which also triggers the multi-image "count" badge. Both are
 * external URLs, so no R2 upload is needed (getImageUrl returns http(s) as-is).
 *
 * Run against the local backend with:
 *   npx convex run seedTestAd:seedTallImageAd
 *
 * Optionally override the shape (puts the landscape first, to test a wide
 * primary thumbnail instead of a tall one):
 *   npx convex run seedTestAd:seedTallImageAd '{"orientation":"wide"}'
 */
export const seedTallImageAd = internalMutation({
  args: {
    // "tall" (default) puts the portrait first; "wide" puts the landscape first.
    orientation: v.optional(v.union(v.literal("tall"), v.literal("wide"))),
  },
  returns: v.id("ads"),
  handler: async (ctx, args) => {
    const [user, category] = await Promise.all([
      ctx.db.query("users").first(),
      ctx.db.query("categories").first(),
    ]);
    if (!user) {
      throw new Error("No users in the local backend — log in once via the app first.");
    }
    if (!category) {
      throw new Error("No categories in the local backend.");
    }

    const tall = "https://picsum.photos/seed/flyerboard-tall/600/1600";
    const wide = "https://picsum.photos/seed/flyerboard-wide/1600/600";
    const images = args.orientation === "wide" ? [wide, tall] : [tall, wide];

    return await ctx.db.insert("ads", {
      title: "TEST — Tall image (aspect-ratio check)",
      description:
        "Seeded local test listing. Off-ratio images (600x1600 portrait + 1600x600 landscape) to verify grid thumbnail fill (blurred backdrop). Safe to delete.",
      listingType: "sale",
      price: 0,
      location: "DOCKLANDS, VIC 3008",
      categoryId: category._id,
      images,
      userId: user._id,
      isActive: true,
      isDeleted: false,
      views: 0,
      bumpedAt: Date.now(), // Boost feed sort key.
      boostCount: 0,
    });
  },
});
