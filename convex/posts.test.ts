// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

// The extglob `!(*.*.*)` pattern returns [] under this repo's vite/vitest setup,
// so glob .ts + .js explicitly and drop .d.ts + test files.
const modules = ((): Record<string, () => Promise<unknown>> => {
  const all = {
    ...import.meta.glob("./**/*.ts"),
    ...import.meta.glob("./**/*.js"),
  } as Record<string, () => Promise<unknown>>;
  const filtered: Record<string, () => Promise<unknown>> = {};
  for (const [key, loader] of Object.entries(all)) {
    if (key.endsWith(".d.ts")) continue;
    if (/\.(test|spec)\.[cm]?[jt]sx?$/.test(key)) continue;
    filtered[key] = loader;
  }
  return filtered;
})();

async function seedUser(
  t: ReturnType<typeof convexTest>,
  subject: string,
  name = "Tester"
): Promise<Id<"users">> {
  return t.run((ctx) =>
    ctx.db.insert("users", { tokenIdentifier: subject, name, isActive: true })
  );
}

async function seedAd(
  t: ReturnType<typeof convexTest>,
  sellerId: Id<"users">,
  title: string
): Promise<Id<"ads">> {
  const category =
    (await t.run((ctx) => ctx.db.query("categories").first())) ??
    (await t.run(async (ctx) => {
      const id = await ctx.db.insert("categories", { name: "Other", slug: "other" });
      return ctx.db.get(id);
    }));
  return t.run((ctx) =>
    ctx.db.insert("ads", {
      title,
      description: "desc",
      location: "Sydney, NSW",
      categoryId: category!._id,
      images: ["r2:a"],
      userId: sellerId,
      isActive: true,
      views: 0,
    })
  );
}

async function seedChat(
  t: ReturnType<typeof convexTest>,
  opts: {
    adId: Id<"ads">;
    buyerId: Id<"users">;
    sellerId: Id<"users">;
    lastMessageAt: number;
  }
): Promise<Id<"chats">> {
  return t.run((ctx) =>
    ctx.db.insert("chats", {
      adId: opts.adId,
      buyerId: opts.buyerId,
      sellerId: opts.sellerId,
      lastMessageAt: opts.lastMessageAt,
    })
  );
}

async function seedMessage(
  t: ReturnType<typeof convexTest>,
  chatId: Id<"chats">,
  senderId: Id<"users">,
  timestamp: number,
  content: string
) {
  await t.run((ctx) =>
    ctx.db.insert("messages", { chatId, senderId, content, timestamp })
  );
}

// ──────────────────────────────────────────────────────────────────────────
// getSellerChats / getBuyerChats — sorted by lastMessageAt desc
// ──────────────────────────────────────────────────────────────────────────
describe("getSellerChats", () => {
  test("returns chats sorted by lastMessageAt descending", async () => {
    const t = convexTest(schema, modules);
    const sellerId = await seedUser(t, "seller", "Seller");
    const buyerA = await seedUser(t, "buyerA", "BuyerA");
    const buyerB = await seedUser(t, "buyerB", "BuyerB");
    const buyerC = await seedUser(t, "buyerC", "BuyerC");

    const adA = await seedAd(t, sellerId, "Ad A");
    const adB = await seedAd(t, sellerId, "Ad B");
    const adC = await seedAd(t, sellerId, "Ad C");

    const now = Date.now();
    // Insert out of chronological order to prove sorting isn't accidental insert order.
    await seedChat(t, { adId: adB, buyerId: buyerB, sellerId, lastMessageAt: now - 1000 });
    await seedChat(t, { adId: adA, buyerId: buyerA, sellerId, lastMessageAt: now });
    await seedChat(t, { adId: adC, buyerId: buyerC, sellerId, lastMessageAt: now - 5000 });

    const asSeller = t.withIdentity({ subject: "seller" });
    const chats = await asSeller.query(api.posts.getSellerChats, {});

    expect(chats).toHaveLength(3);
    expect(chats.map((c) => c.lastMessageAt)).toEqual([
      now,
      now - 1000,
      now - 5000,
    ]);
  });

  test("returns empty array when unauthenticated", async () => {
    const t = convexTest(schema, modules);
    const chats = await t.query(api.posts.getSellerChats, {});
    expect(chats).toEqual([]);
  });

  test("includes latestMessage with the newest message content", async () => {
    const t = convexTest(schema, modules);
    const sellerId = await seedUser(t, "sellerLM", "Seller");
    const buyerId = await seedUser(t, "buyerLM", "Buyer");
    const adId = await seedAd(t, sellerId, "Ad LM");

    const now = Date.now();
    const chatId = await seedChat(t, { adId, buyerId, sellerId, lastMessageAt: now });
    await seedMessage(t, chatId, buyerId, now - 2000, "first message");
    await seedMessage(t, chatId, buyerId, now, "newest message");

    const asSeller = t.withIdentity({ subject: "sellerLM" });
    const chats = await asSeller.query(api.posts.getSellerChats, {});

    expect(chats).toHaveLength(1);
    expect(chats[0].latestMessage).not.toBeNull();
    expect(chats[0].latestMessage!.content).toBe("newest message");
  });

  test("latestMessage is null for a chat with no messages", async () => {
    const t = convexTest(schema, modules);
    const sellerId = await seedUser(t, "sellerNM", "Seller");
    const buyerId = await seedUser(t, "buyerNM", "Buyer");
    const adId = await seedAd(t, sellerId, "Ad NM");
    await seedChat(t, { adId, buyerId, sellerId, lastMessageAt: Date.now() });

    const asSeller = t.withIdentity({ subject: "sellerNM" });
    const chats = await asSeller.query(api.posts.getSellerChats, {});

    expect(chats).toHaveLength(1);
    expect(chats[0].latestMessage).toBeNull();
  });
});

describe("getBuyerChats", () => {
  test("returns chats sorted by lastMessageAt descending", async () => {
    const t = convexTest(schema, modules);
    const buyerId = await seedUser(t, "buyer", "Buyer");
    const sellerA = await seedUser(t, "sellerA", "SellerA");
    const sellerB = await seedUser(t, "sellerB", "SellerB");
    const sellerC = await seedUser(t, "sellerC", "SellerC");

    const adA = await seedAd(t, sellerA, "Ad A");
    const adB = await seedAd(t, sellerB, "Ad B");
    const adC = await seedAd(t, sellerC, "Ad C");

    const now = Date.now();
    await seedChat(t, { adId: adA, buyerId, sellerId: sellerA, lastMessageAt: now - 5000 });
    await seedChat(t, { adId: adB, buyerId, sellerId: sellerB, lastMessageAt: now });
    await seedChat(t, { adId: adC, buyerId, sellerId: sellerC, lastMessageAt: now - 1000 });

    const asBuyer = t.withIdentity({ subject: "buyer" });
    const chats = await asBuyer.query(api.posts.getBuyerChats, {});

    expect(chats).toHaveLength(3);
    expect(chats.map((c) => c.lastMessageAt)).toEqual([
      now,
      now - 1000,
      now - 5000,
    ]);
  });

  test("returns empty array when unauthenticated", async () => {
    const t = convexTest(schema, modules);
    const chats = await t.query(api.posts.getBuyerChats, {});
    expect(chats).toEqual([]);
  });

  test("includes latestMessage with the newest message content", async () => {
    const t = convexTest(schema, modules);
    const buyerId = await seedUser(t, "buyerLM2", "Buyer");
    const sellerId = await seedUser(t, "sellerLM2", "Seller");
    const adId = await seedAd(t, sellerId, "Ad LM2");

    const now = Date.now();
    const chatId = await seedChat(t, { adId, buyerId, sellerId, lastMessageAt: now });
    await seedMessage(t, chatId, buyerId, now - 2000, "older question");
    await seedMessage(t, chatId, sellerId, now, "latest reply");

    const asBuyer = t.withIdentity({ subject: "buyerLM2" });
    const chats = await asBuyer.query(api.posts.getBuyerChats, {});

    expect(chats).toHaveLength(1);
    expect(chats[0].latestMessage).not.toBeNull();
    expect(chats[0].latestMessage!.content).toBe("latest reply");
  });
});
