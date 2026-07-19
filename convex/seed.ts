import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

/**
 * Seed a complete, published sample Moving Sale for local/dev testing.
 *
 * Run it (the owner must have logged in at least once):
 *   npx convex run seed:seedMovingSale '{"email":"you@example.com"}'
 *
 * Prints the public slug — open /sale/<slug>. Idempotent-ish: pass
 * `{"reset": true}` to remove this user's previously-seeded demo sales first.
 */

const SLUG_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
function randomSuffix(): string {
  let out = "";
  for (let i = 0; i < 4; i++) {
    out += SLUG_ALPHABET[Math.floor(Math.random() * SLUG_ALPHABET.length)];
  }
  return out;
}

/** Next Saturday 9am–2pm (local server time), relative to now. */
function nextSaturdayWindow(): { start: number; end: number } {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  let add = (6 - d.getDay() + 7) % 7;
  if (add === 0) add = 7; // always upcoming, never today
  d.setDate(d.getDate() + add);
  const start = new Date(d);
  start.setHours(9, 0, 0, 0);
  const end = new Date(d);
  end.setHours(14, 0, 0, 0);
  return { start: start.getTime(), end: end.getTime() };
}

// Stable Unsplash images — getImageUrl returns http(s) refs as-is, so no R2 upload needed.
const PHOTO = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=800&q=70`;

interface SeedItem {
  title: string;
  price: number;
  condition: string;
  categorySlug: string;
  image: string;
  isSold?: boolean;
}

const SEED_ITEMS: SeedItem[] = [
  { title: "2-seat fabric sofa", price: 180, condition: "Good", categorySlug: "home-garden", image: PHOTO("1555041469-a586c61ea9bc") },
  { title: "Standing desk (electric)", price: 90, condition: "Like new", categorySlug: "home-garden", image: PHOTO("1595515106969-1ce29566ff1c") },
  { title: "Ergonomic office chair", price: 45, condition: "Good", categorySlug: "home-garden", image: PHOTO("1580480055273-228ff5388ef8") },
  { title: '27" 4K monitor', price: 120, condition: "Like new", categorySlug: "electronics", image: PHOTO("1527443224154-c4a3942d3acf") },
  { title: "Coffee maker", price: 35, condition: "Good", categorySlug: "home-garden", image: PHOTO("1517668808822-9ebb02f2a0e6"), isSold: true },
  { title: "Bookshelf + 20 books", price: 25, condition: "Fair", categorySlug: "books-media", image: PHOTO("1507842217343-583bb7270b66") },
  { title: "Floor lamp", price: 20, condition: "Good", categorySlug: "home-garden", image: PHOTO("1507473885765-e6ed057f782c") },
  { title: "Commuter bike", price: 150, condition: "Good", categorySlug: "sports", image: PHOTO("1485965120184-e220f721d03e") },
];

/**
 * Local-dev-only: wipe every seeded Moving Sale (and its items/bundles) plus
 * the placeholder `seed|...` users created to own them. Safe to delete —
 * targets only rows created by seedMovingSale, never a real Descope-synced user.
 *
 * Run it with:
 *   npx convex run seed:wipeSeededMovingSales
 */
export const wipeSeededMovingSales = internalMutation({
  args: {},
  handler: async (ctx) => {
    const sales = await ctx.db.query("saleEvents").collect();
    let items = 0;
    let bundles = 0;
    for (const sale of sales) {
      const saleItems = await ctx.db
        .query("ads")
        .withIndex("by_sale_event", (q) => q.eq("saleEventId", sale._id))
        .collect();
      for (const item of saleItems) await ctx.db.delete(item._id);
      items += saleItems.length;
      const saleBundles = await ctx.db
        .query("saleBundles")
        .withIndex("by_sale_event", (q) => q.eq("saleEventId", sale._id))
        .collect();
      for (const b of saleBundles) await ctx.db.delete(b._id);
      bundles += saleBundles.length;
      await ctx.db.delete(sale._id);
    }

    const users = await ctx.db.query("users").collect();
    let placeholderUsers = 0;
    for (const user of users) {
      if (user.tokenIdentifier?.startsWith("seed|")) {
        await ctx.db.delete(user._id);
        placeholderUsers++;
      }
    }

    return { sales: sales.length, items, bundles, placeholderUsers };
  },
});

/**
 * Local-dev-only: create or update a feature flag without going through the
 * admin-only `featureFlags:createFeatureFlag`/`updateFeatureFlag` mutations
 * (useful for toggling flags via `npx convex run` when no admin user is set
 * up locally yet). Mirrors the real flag shape exactly — safe to flip back
 * through the real Admin > Feature Flags UI once an admin exists.
 *
 * Run it with:
 *   npx convex run seed:setFeatureFlagLocal '{"key":"movingSaleDesignForceB","enabled":true,"description":"Force everyone to Moving Sale design Variant B"}'
 */
export const setFeatureFlagLocal = internalMutation({
  args: {
    key: v.string(),
    enabled: v.boolean(),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("featureFlags")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { enabled: args.enabled, description: args.description });
      return { updated: true };
    }
    await ctx.db.insert("featureFlags", {
      key: args.key,
      enabled: args.enabled,
      description: args.description,
    });
    return { created: true };
  },
});

export const seedMovingSale = internalMutation({
  args: {
    email: v.optional(v.string()),
    phone: v.optional(v.string()), // attach to an existing phone-OTP user, e.g. "0466666666"
    reset: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    if (!args.email && !args.phone) {
      throw new Error("Provide an email or phone to own the sale.");
    }

    // 1. Owner — prefer an existing user (by phone, then email) so the sale lands
    // in their account just like the other locally-seeded ads. Only create a dev
    // owner as a last resort (fresh deployment with no matching user).
    let user = null;
    if (args.phone) {
      user =
        (await ctx.db.query("users").collect()).find((u) => u.phone === args.phone) ??
        null;
    }
    if (!user && args.email) {
      user = await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", args.email))
        .first();
    }
    let createdOwner = false;
    if (!user) {
      const ownerId = await ctx.db.insert("users", {
        email: args.email,
        phone: args.phone,
        name: args.email ? args.email.split("@")[0] : `User ${args.phone}`,
        tokenIdentifier: `seed|${args.phone ?? args.email}`,
        isActive: true,
      });
      user = await ctx.db.get(ownerId);
      createdOwner = true;
    }
    if (!user) throw new Error("Failed to resolve seed owner.");

    // Optional cleanup of prior demo sales for this user.
    if (args.reset) {
      const prior = await ctx.db
        .query("saleEvents")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect();
      for (const sale of prior.filter((s) => s.slug?.includes("-demo-"))) {
        const items = await ctx.db
          .query("ads")
          .withIndex("by_sale_event", (q) => q.eq("saleEventId", sale._id))
          .collect();
        for (const item of items) await ctx.db.delete(item._id);
        const bundles = await ctx.db
          .query("saleBundles")
          .withIndex("by_sale_event", (q) => q.eq("saleEventId", sale._id))
          .collect();
        for (const b of bundles) await ctx.db.delete(b._id);
        await ctx.db.delete(sale._id);
      }
    }

    // 2. Categories by slug (fallback to first category).
    const categories = await ctx.db.query("categories").collect();
    if (categories.length === 0) {
      throw new Error("No categories configured — run migrations:ensureAllCategories first.");
    }
    const bySlug = new Map(categories.map((c) => [c.slug, c._id]));
    const categoryFor = (slug: string): Id<"categories"> =>
      bySlug.get(slug) ?? categories[0]._id;

    // 3. Sale event (published / paid so the public page works).
    const firstName = (user.name ?? user.email ?? "My").split(/[\s@]/)[0];
    const { start, end } = nextSaturdayWindow();
    const slug = `${firstName.toLowerCase().replace(/[^a-z0-9]/g, "") || "my"}-sale-richmond-demo-${randomSuffix()}`;

    const saleEventId = await ctx.db.insert("saleEvents", {
      userId: user._id,
      slug,
      title: `${firstName}'s Moving Sale`,
      suburb: "Richmond, VIC",
      note: "Everything must go before we move! Cash or bank transfer. Bring a friend for the big stuff.",
      pickupWindowStart: start,
      pickupWindowEnd: end,
      status: "active",
      expiresAt: end + 2 * 24 * 60 * 60 * 1000,
      createdAt: Date.now(),
      bumpedAt: Date.now(), // Unified-feed sort key.
      boostCount: 0,
    });

    // 4. Items (live ads tied to the sale).
    const idByTitle = new Map<string, Id<"ads">>();
    for (const item of SEED_ITEMS) {
      const adId = await ctx.db.insert("ads", {
        title: item.title,
        description: `${item.condition} condition. Part of ${firstName}'s moving sale in Richmond — pickup Saturday.`,
        listingType: "sale",
        price: item.price,
        location: "Richmond, VIC",
        categoryId: categoryFor(item.categorySlug),
        images: [item.image],
        userId: user._id,
        isActive: true,
        isSold: item.isSold ?? false,
        saleEventId,
        condition: item.condition,
        views: Math.floor(Math.random() * 40),
        bumpedAt: Date.now(), // Boost feed sort key.
        boostCount: 0,
      });
      idByTitle.set(item.title, adId);
    }

    // 5. Bundles.
    const bundleSpecs = [
      { label: "Home office setup", price: 220, titles: ["Standing desk (electric)", "Ergonomic office chair", '27" 4K monitor'] },
      { label: "Living room", price: 190, titles: ["2-seat fabric sofa", "Floor lamp"] },
    ];
    for (const spec of bundleSpecs) {
      const adIds = spec.titles
        .map((t) => idByTitle.get(t))
        .filter((x): x is Id<"ads"> => Boolean(x));
      if (adIds.length < 2) continue;
      const bundleId = await ctx.db.insert("saleBundles", {
        saleEventId,
        label: spec.label,
        bundlePrice: spec.price,
        adIds,
        bumpedAt: Date.now(), // Unified-feed sort key (sale bundles never feed, but keep the field total).
      });
      for (const adId of adIds) await ctx.db.patch(adId, { bundleId });
    }

    return {
      success: true,
      slug,
      publicPath: `/sale/${slug}`,
      items: SEED_ITEMS.length,
      createdOwner,
      owner: { id: user._id, name: user.name ?? null, email: user.email ?? null, phone: user.phone ?? null },
      message: `Seeded "${firstName}'s Moving Sale" for ${user.name ?? user.phone ?? user.email}. Open /sale/${slug}`,
    };
  },
});

/**
 * Seed a few standalone furniture ads owned by a real (logged-in) user so you can
 * test Bundle Listing without hand-posting them. The owner must have logged in at
 * least once (so their Convex `users` row exists).
 *
 *   npx convex run seed:seedBundleAds '{"email":"you@example.com"}'
 *
 * Prints the ad ids. Then in the app: Dashboard → My Flyers → "Bundle ads".
 * Pass `{"reset": true}` to first delete this user's previously-seeded demo ads.
 */
const BUNDLE_SEED_ADS = [
  {
    title: "Mid-century 3-seat sofa",
    description: "Walnut frame, forest-green wool. Barely used, from a smoke-free home.",
    price: 350,
    images: ["https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800&h=600&fit=crop"],
  },
  {
    title: "Solid oak dining table",
    description: "Seats six. A few honest marks but structurally perfect.",
    price: 280,
    images: ["https://images.unsplash.com/photo-1577140917170-285929fb55b7?w=800&h=600&fit=crop"],
  },
  {
    title: "Round marble coffee table",
    description: "White carrara top, brass legs. Statement piece.",
    price: 120,
    images: ["https://images.unsplash.com/photo-1499933374294-4584851497cc?w=800&h=600&fit=crop"],
  },
];

export const seedBundleAds = internalMutation({
  args: { email: v.optional(v.string()), phone: v.optional(v.string()), reset: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    // Resolve the owner by email (or phone) — mirrors seedMovingSale.
    let user = null;
    if (args.email) {
      user = await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", args.email))
        .first();
    }
    if (!user && args.phone) {
      user = await ctx.db.query("users").filter((q) => q.eq(q.field("phone"), args.phone)).first();
    }
    if (!user) {
      throw new Error(
        `No user found for ${args.email ?? args.phone ?? "(none provided)"} — make sure they've logged in at least once.`
      );
    }

    if (args.reset) {
      const owned = await ctx.db
        .query("ads")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect();
      for (const ad of owned) {
        if (BUNDLE_SEED_ADS.some((s) => s.title === ad.title)) await ctx.db.delete(ad._id);
      }
    }

    const category = await ctx.db.query("categories").first();
    if (!category) throw new Error("No categories exist — run sampleData:clearAndCreateSampleData first.");

    const createdIds: Id<"ads">[] = [];
    for (const seed of BUNDLE_SEED_ADS) {
      const id = await ctx.db.insert("ads", {
        title: seed.title,
        description: seed.description,
        listingType: "sale",
        price: seed.price,
        location: "Richmond, VIC",
        categoryId: category._id,
        images: seed.images,
        userId: user._id,
        isActive: true,
        isSold: false,
        views: 0,
        bumpedAt: Date.now(), // Boost feed sort key.
        boostCount: 0,
      });
      createdIds.push(id);
    }

    return {
      success: true,
      createdIds,
      owner: { id: user._id, name: user.name ?? null, email: user.email ?? null },
      message: `Seeded ${createdIds.length} standalone ads for ${user.name ?? user.email}. Dashboard → My Flyers → "Bundle ads".`,
    };
  },
});
