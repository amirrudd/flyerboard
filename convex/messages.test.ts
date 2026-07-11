// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe, beforeEach, afterEach } from "vitest";
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

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

async function seedUser(
  t: ReturnType<typeof convexTest>,
  subject: string,
  name = "Tester"
): Promise<Id<"users">> {
  return t.run((ctx) =>
    ctx.db.insert("users", { tokenIdentifier: subject, name, isActive: true })
  );
}

/** Seed a category + an ad owned by `sellerSubject`. */
async function seedAd(
  t: ReturnType<typeof convexTest>,
  sellerId: Id<"users">
): Promise<Id<"ads">> {
  const categoryId = await t.run((ctx) =>
    ctx.db.insert("categories", { name: "Other", slug: "other" })
  );
  return t.run((ctx) =>
    ctx.db.insert("ads", {
      title: "Test Ad",
      description: "desc",
      location: "Sydney, NSW",
      categoryId,
      images: ["r2:a"],
      userId: sellerId,
      isActive: true,
      views: 0,
      bumpedAt: Date.now(),
    })
  );
}

/** Seed a chat directly (bypassing sendMessage) so we control timestamps/reads. */
async function seedChat(
  t: ReturnType<typeof convexTest>,
  opts: {
    adId?: Id<"ads">;
    saleEventId?: Id<"saleEvents">;
    buyerId: Id<"users">;
    sellerId: Id<"users">;
    lastMessageAt: number;
    lastReadBySeller?: number;
    lastReadByBuyer?: number;
    archivedBySeller?: boolean;
    archivedByBuyer?: boolean;
    deletedBySeller?: boolean;
    deletedByBuyer?: boolean;
  }
): Promise<Id<"chats">> {
  return t.run((ctx) =>
    ctx.db.insert("chats", {
      adId: opts.adId,
      saleEventId: opts.saleEventId,
      buyerId: opts.buyerId,
      sellerId: opts.sellerId,
      lastMessageAt: opts.lastMessageAt,
      lastReadBySeller: opts.lastReadBySeller,
      lastReadByBuyer: opts.lastReadByBuyer,
      archivedBySeller: opts.archivedBySeller,
      archivedByBuyer: opts.archivedByBuyer,
      deletedBySeller: opts.deletedBySeller,
      deletedByBuyer: opts.deletedByBuyer,
    })
  );
}

async function seedMessage(
  t: ReturnType<typeof convexTest>,
  chatId: Id<"chats">,
  senderId: Id<"users">,
  timestamp: number,
  content = "hi"
) {
  await t.run((ctx) =>
    ctx.db.insert("messages", { chatId, senderId, content, timestamp })
  );
}

// ──────────────────────────────────────────────────────────────────────────
// getTotalUnreadCount
// ──────────────────────────────────────────────────────────────────────────
describe("getTotalUnreadCount", () => {
  test("returns 0 when unauthenticated", async () => {
    const t = convexTest(schema, modules);
    const result = await t.query(api.messages.getTotalUnreadCount, {});
    expect(result).toBe(0);
  });

  test("counts unread messages where user is seller", async () => {
    const t = convexTest(schema, modules);
    const sellerId = await seedUser(t, "seller", "Seller");
    const buyerId = await seedUser(t, "buyer", "Buyer");
    const adId = await seedAd(t, sellerId);

    const chatId = await seedChat(t, {
      adId,
      buyerId,
      sellerId,
      lastMessageAt: Date.now(),
      lastReadBySeller: Date.now() - HOUR,
    });
    // Two unread messages from the buyer (sender != seller).
    await seedMessage(t, chatId, buyerId, Date.now() - 30 * 60 * 1000);
    await seedMessage(t, chatId, buyerId, Date.now() - 10 * 60 * 1000);

    const asSeller = t.withIdentity({ subject: "seller" });
    const result = await asSeller.query(api.messages.getTotalUnreadCount, {});
    expect(result).toBe(2);
  });

  test("counts unread messages where user is buyer", async () => {
    const t = convexTest(schema, modules);
    const sellerId = await seedUser(t, "seller2", "Seller");
    const buyerId = await seedUser(t, "buyer2", "Buyer");
    const adId = await seedAd(t, sellerId);

    const chatId = await seedChat(t, {
      adId,
      buyerId,
      sellerId,
      lastMessageAt: Date.now(),
      lastReadByBuyer: Date.now() - HOUR,
    });
    // One unread message from the seller (sender != buyer).
    await seedMessage(t, chatId, sellerId, Date.now() - 10 * 60 * 1000);

    const asBuyer = t.withIdentity({ subject: "buyer2" });
    const result = await asBuyer.query(api.messages.getTotalUnreadCount, {});
    expect(result).toBe(1);
  });

  test("sums unread across seller chats and buyer chats for the same user", async () => {
    const t = convexTest(schema, modules);
    const userId = await seedUser(t, "hybrid", "Hybrid");
    const otherA = await seedUser(t, "otherA", "OtherA");
    const otherB = await seedUser(t, "otherB", "OtherB");
    const adA = await seedAd(t, userId); // user is seller here
    const adB = await seedAd(t, otherB); // user is buyer here

    // Chat where `userId` is the seller.
    const chatSelling = await seedChat(t, {
      adId: adA,
      buyerId: otherA,
      sellerId: userId,
      lastMessageAt: Date.now(),
      lastReadBySeller: Date.now() - HOUR,
    });
    await seedMessage(t, chatSelling, otherA, Date.now() - 10 * 60 * 1000);

    // Chat where `userId` is the buyer.
    const chatBuying = await seedChat(t, {
      adId: adB,
      buyerId: userId,
      sellerId: otherB,
      lastMessageAt: Date.now(),
      lastReadByBuyer: Date.now() - HOUR,
    });
    await seedMessage(t, chatBuying, otherB, Date.now() - 10 * 60 * 1000);
    await seedMessage(t, chatBuying, otherB, Date.now() - 5 * 60 * 1000);

    const asUser = t.withIdentity({ subject: "hybrid" });
    const result = await asUser.query(api.messages.getTotalUnreadCount, {});
    expect(result).toBe(3); // 1 as seller + 2 as buyer
  });

  test("excludes chats archived for that role", async () => {
    const t = convexTest(schema, modules);
    const sellerId = await seedUser(t, "seller3", "Seller");
    const buyerId = await seedUser(t, "buyer3", "Buyer");
    const adId = await seedAd(t, sellerId);

    const archivedChat = await seedChat(t, {
      adId,
      buyerId,
      sellerId,
      lastMessageAt: Date.now(),
      archivedBySeller: true,
    });
    await seedMessage(t, archivedChat, buyerId, Date.now());

    const asSeller = t.withIdentity({ subject: "seller3" });
    const result = await asSeller.query(api.messages.getTotalUnreadCount, {});
    expect(result).toBe(0);
  });

  test("does not count the user's own messages as unread", async () => {
    const t = convexTest(schema, modules);
    const sellerId = await seedUser(t, "seller4", "Seller");
    const buyerId = await seedUser(t, "buyer4", "Buyer");
    const adId = await seedAd(t, sellerId);

    const chatId = await seedChat(t, {
      adId,
      buyerId,
      sellerId,
      lastMessageAt: Date.now(),
    });
    await seedMessage(t, chatId, sellerId, Date.now()); // seller's own message

    const asSeller = t.withIdentity({ subject: "seller4" });
    const result = await asSeller.query(api.messages.getTotalUnreadCount, {});
    expect(result).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// sendMessage — sale-thread notification scheduling
// ──────────────────────────────────────────────────────────────────────────
describe("sendMessage notification scheduling", () => {
  const originalPush = process.env.ENABLE_PUSH_NOTIFICATIONS;
  const originalEmail = process.env.ENABLE_EMAIL_NOTIFICATIONS;

  beforeEach(() => {
    process.env.ENABLE_PUSH_NOTIFICATIONS = "true";
    process.env.ENABLE_EMAIL_NOTIFICATIONS = "true";
  });

  afterEach(() => {
    process.env.ENABLE_PUSH_NOTIFICATIONS = originalPush;
    process.env.ENABLE_EMAIL_NOTIFICATIONS = originalEmail;
  });

  test("schedules push + queues email for an item-chat message", async () => {
    const t = convexTest(schema, modules);
    const sellerId = await seedUser(t, "isel", "Seller");
    const buyerId = await seedUser(t, "ibuy", "Buyer");
    const adId = await seedAd(t, sellerId);
    const chatId = await seedChat(t, {
      adId,
      buyerId,
      sellerId,
      lastMessageAt: Date.now(),
    });

    const asBuyer = t.withIdentity({ subject: "ibuy" });
    await asBuyer.mutation(api.messages.sendMessage, {
      chatId,
      content: "Is this still available?",
    });

    const scheduled = await t.run((ctx) =>
      (ctx.db as any).system.query("_scheduled_functions").collect() as Promise<any[]>
    );
    const pushJob = scheduled.find((j: any) =>
      j.name.includes("notifyMessageReceived") && j.name.includes("pushNotifications")
    );
    expect(pushJob).toBeDefined();

    const pending = await t.run((ctx) => ctx.db.query("pendingEmailNotifications").collect());
    expect(pending).toHaveLength(1);
    expect(pending[0].adId).toBe(adId);
    expect(pending[0].saleEventId).toBeUndefined();
  });

  test("schedules push + queues email for a sale-thread message via sendMessage", async () => {
    const t = convexTest(schema, modules);
    const sellerId = await seedUser(t, "ssel", "Seller");
    const buyerId = await seedUser(t, "sbuy", "Buyer");
    const saleEventId = await t.run((ctx) =>
      ctx.db.insert("saleEvents", {
        userId: sellerId,
        title: "Moving Sale",
        suburb: "Richmond, VIC",
        pickupWindowStart: Date.now() + DAY,
        pickupWindowEnd: Date.now() + DAY + 2 * HOUR,
        status: "active",
        slug: "sellers-sale-richmond-abcd",
        createdAt: Date.now(),
      })
    );
    const chatId = await seedChat(t, {
      saleEventId,
      buyerId,
      sellerId,
      lastMessageAt: Date.now(),
    });

    const asBuyer = t.withIdentity({ subject: "sbuy" });
    await asBuyer.mutation(api.messages.sendMessage, {
      chatId,
      content: "Can I get the chair?",
    });

    const scheduled = await t.run((ctx) =>
      (ctx.db as any).system.query("_scheduled_functions").collect() as Promise<any[]>
    );
    const pushJob = scheduled.find((j: any) =>
      j.name.includes("notifyMessageReceived") && j.name.includes("pushNotifications")
    );
    expect(pushJob).toBeDefined();

    const pending = await t.run((ctx) => ctx.db.query("pendingEmailNotifications").collect());
    expect(pending).toHaveLength(1);
    expect(pending[0].saleEventId).toBe(saleEventId);
    expect(pending[0].adId).toBeUndefined();
  });
});

// ──────────────────────────────────────────────────────────────────────────
// deleteArchivedChats — one-sided delete
// ──────────────────────────────────────────────────────────────────────────
describe("deleteArchivedChats", () => {
  test("throws when unauthenticated", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.mutation(api.messages.deleteArchivedChats, { chatIds: [] })
    ).rejects.toThrow("Not authenticated");
  });

  test("buyer delete on archived chat soft-hides it, keeps row + messages + seller's copy", async () => {
    const t = convexTest(schema, modules);
    const sellerId = await seedUser(t, "d_sel", "Seller");
    const buyerId = await seedUser(t, "d_buy", "Buyer");
    const adId = await seedAd(t, sellerId);

    const chatId = await seedChat(t, {
      adId,
      buyerId,
      sellerId,
      lastMessageAt: Date.now(),
      archivedByBuyer: true,
    });
    await seedMessage(t, chatId, sellerId, Date.now());

    const asBuyer = t.withIdentity({ subject: "d_buy" });
    await asBuyer.mutation(api.messages.deleteArchivedChats, { chatIds: [chatId] });

    // Row still exists, flag set, messages intact.
    const chat = await t.run((ctx) => ctx.db.get(chatId));
    expect(chat).not.toBeNull();
    expect(chat!.deletedByBuyer).toBe(true);
    const msgs = await t.run((ctx) =>
      ctx.db.query("messages").withIndex("by_chat", (q) => q.eq("chatId", chatId)).collect()
    );
    expect(msgs).toHaveLength(1);

    // Hidden from the buyer's archived list and buyer chats.
    const archived = await asBuyer.query(api.messages.getArchivedChats, {});
    expect(archived).toHaveLength(0);
    const buyerChats = await asBuyer.query(api.posts.getBuyerChats, {});
    expect(buyerChats).toHaveLength(0);

    // Still visible to the seller.
    const asSeller = t.withIdentity({ subject: "d_sel" });
    const sellerChats = await asSeller.query(api.posts.getSellerChats, {});
    expect(sellerChats).toHaveLength(1);
  });

  test("second side's delete hard-removes the chat row and its messages", async () => {
    const t = convexTest(schema, modules);
    const sellerId = await seedUser(t, "h_sel", "Seller");
    const buyerId = await seedUser(t, "h_buy", "Buyer");
    const adId = await seedAd(t, sellerId);

    // Seller already deleted their side; buyer's side is archived.
    const chatId = await seedChat(t, {
      adId,
      buyerId,
      sellerId,
      lastMessageAt: Date.now(),
      archivedByBuyer: true,
      deletedBySeller: true,
    });
    await seedMessage(t, chatId, sellerId, Date.now());

    const asBuyer = t.withIdentity({ subject: "h_buy" });
    await asBuyer.mutation(api.messages.deleteArchivedChats, { chatIds: [chatId] });

    const chat = await t.run((ctx) => ctx.db.get(chatId));
    expect(chat).toBeNull();
    const msgs = await t.run((ctx) =>
      ctx.db.query("messages").withIndex("by_chat", (q) => q.eq("chatId", chatId)).collect()
    );
    expect(msgs).toHaveLength(0);
  });

  test("no-op on a non-archived chat", async () => {
    const t = convexTest(schema, modules);
    const sellerId = await seedUser(t, "na_sel", "Seller");
    const buyerId = await seedUser(t, "na_buy", "Buyer");
    const adId = await seedAd(t, sellerId);

    const chatId = await seedChat(t, {
      adId,
      buyerId,
      sellerId,
      lastMessageAt: Date.now(),
      // not archived
    });

    const asBuyer = t.withIdentity({ subject: "na_buy" });
    await asBuyer.mutation(api.messages.deleteArchivedChats, { chatIds: [chatId] });

    const chat = await t.run((ctx) => ctx.db.get(chatId));
    expect(chat).not.toBeNull();
    expect(chat!.deletedByBuyer).toBeUndefined();
  });

  test("no-op when caller is not a participant", async () => {
    const t = convexTest(schema, modules);
    const sellerId = await seedUser(t, "np_sel", "Seller");
    const buyerId = await seedUser(t, "np_buy", "Buyer");
    await seedUser(t, "np_stranger", "Stranger");
    const adId = await seedAd(t, sellerId);

    const chatId = await seedChat(t, {
      adId,
      buyerId,
      sellerId,
      lastMessageAt: Date.now(),
      archivedByBuyer: true,
    });

    const asStranger = t.withIdentity({ subject: "np_stranger" });
    await asStranger.mutation(api.messages.deleteArchivedChats, { chatIds: [chatId] });

    const chat = await t.run((ctx) => ctx.db.get(chatId));
    expect(chat).not.toBeNull();
    expect(chat!.deletedByBuyer).toBeUndefined();
    expect(chat!.deletedBySeller).toBeUndefined();
  });
});
