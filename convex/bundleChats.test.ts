// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe, beforeEach, afterEach } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

// Load all Convex modules so convex-test can run them (same loader as saleChats.test.ts).
const modules = loadConvexModules();
function loadConvexModules(): Record<string, () => Promise<unknown>> {
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
}

async function seedUser(
  t: ReturnType<typeof convexTest>,
  subject: string,
  name = "Tester"
): Promise<Id<"users">> {
  return t.run((ctx) =>
    ctx.db.insert("users", { tokenIdentifier: subject, name, isActive: true })
  );
}

/**
 * Build an active standalone bundle owned by seller "A" (two ads), plus a
 * buyer "B". Returns handles + ids.
 */
async function seedBundle() {
  const t = convexTest(schema, modules);
  const sellerId = await seedUser(t, "A", "Seller");
  const buyerId = await seedUser(t, "B", "Buyer");
  const categoryId = await t.run((ctx) =>
    ctx.db.insert("categories", { name: "Other", slug: "other" })
  );
  const insertAd = (title: string, price: number) =>
    t.run((ctx) =>
      ctx.db.insert("ads", {
        title,
        description: "desc",
        price,
        location: "Coogee, NSW",
        categoryId,
        images: ["r2:flyers/x/1.jpg"],
        userId: sellerId,
        isActive: true,
        views: 0,
        bumpedAt: Date.now(),
      })
    );
  const a = await insertAd("Sofa", 350);
  const b = await insertAd("Table", 280);
  const asSeller = t.withIdentity({ subject: "A" });
  const asBuyer = t.withIdentity({ subject: "B" });
  const bundleId = await asSeller.mutation(api.bundles.createBundle, {
    adIds: [a, b],
    bundlePrice: 530,
  });
  return { t, sellerId, buyerId, asSeller, asBuyer, bundleId };
}

describe("sendBundleMessage", () => {
  test("throws when unauthenticated", async () => {
    const { t, bundleId } = await seedBundle();
    await expect(
      t.mutation(api.bundleChats.sendBundleMessage, { bundleId, content: "Hi" })
    ).rejects.toThrow(/logged in/i);
  });

  test("seller cannot message their own bundle", async () => {
    const { asSeller, bundleId } = await seedBundle();
    await expect(
      asSeller.mutation(api.bundleChats.sendBundleMessage, { bundleId, content: "Hi" })
    ).rejects.toThrow(/own bundle/i);
  });

  test("rejects empty content", async () => {
    const { asBuyer, bundleId } = await seedBundle();
    await expect(
      asBuyer.mutation(api.bundleChats.sendBundleMessage, { bundleId, content: "   " })
    ).rejects.toThrow(/empty/i);
  });

  test("rejects a cancelled bundle", async () => {
    const { asSeller, asBuyer, bundleId } = await seedBundle();
    await asSeller.mutation(api.bundles.cancelBundle, { bundleId });
    await expect(
      asBuyer.mutation(api.bundleChats.sendBundleMessage, { bundleId, content: "Hi" })
    ).rejects.toThrow(/not found/i);
  });

  test("reuses one chat per buyer per bundle across multiple sends", async () => {
    const { t, asBuyer, bundleId, buyerId, sellerId } = await seedBundle();

    const first = await asBuyer.mutation(api.bundleChats.sendBundleMessage, {
      bundleId,
      content: "I'll take both for $530",
    });
    const second = await asBuyer.mutation(api.bundleChats.sendBundleMessage, {
      bundleId,
      content: "Can I pick up Saturday?",
    });
    expect(second.chatId).toBe(first.chatId);

    const chats = await t.run((ctx) => ctx.db.query("chats").collect());
    expect(chats).toHaveLength(1);
    expect(chats[0].bundleId).toBe(bundleId);
    expect(chats[0].adId).toBeUndefined();
    expect(chats[0].saleEventId).toBeUndefined();
    expect(chats[0].buyerId).toBe(buyerId);
    expect(chats[0].sellerId).toBe(sellerId);

    const messages = await t.run((ctx) => ctx.db.query("messages").collect());
    expect(messages).toHaveLength(2);
  });
});

describe("getBundleThread", () => {
  test("returns null when unauthenticated", async () => {
    const { t, bundleId } = await seedBundle();
    expect(await t.query(api.bundleChats.getBundleThread, { bundleId })).toBeNull();
  });

  test("returns empty thread before any message", async () => {
    const { asBuyer, bundleId } = await seedBundle();
    const thread = await asBuyer.query(api.bundleChats.getBundleThread, { bundleId });
    expect(thread).toEqual({ chatId: null, messages: [] });
  });

  test("returns messages with mine:true for the sender", async () => {
    const { asBuyer, bundleId } = await seedBundle();
    await asBuyer.mutation(api.bundleChats.sendBundleMessage, {
      bundleId,
      content: "Deal!",
    });
    const thread = await asBuyer.query(api.bundleChats.getBundleThread, { bundleId });
    expect(thread!.chatId).not.toBeNull();
    expect(thread!.messages).toHaveLength(1);
    expect(thread!.messages[0].content).toBe("Deal!");
    expect(thread!.messages[0].mine).toBe(true);
  });
});

describe("sendBundleMessage notifications", () => {
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

  test("schedules a push notification and queues an email for the seller", async () => {
    const { t, asBuyer, bundleId, sellerId } = await seedBundle();

    const { chatId } = await asBuyer.mutation(api.bundleChats.sendBundleMessage, {
      bundleId,
      content: "I'll take the lot",
    });

    const scheduled = await t.run((ctx) =>
      (ctx.db as any).system.query("_scheduled_functions").collect() as Promise<any[]>
    );
    const pushJob = scheduled.find(
      (j: any) =>
        j.name.includes("notifyMessageReceived") &&
        j.name.includes("pushNotifications")
    );
    expect(pushJob).toBeDefined();
    expect(pushJob!.args[0].recipientId).toBe(sellerId);
    expect(pushJob!.args[0].bundleId).toBe(bundleId);

    const pending = await t.run((ctx) =>
      ctx.db.query("pendingEmailNotifications").collect()
    );
    expect(pending).toHaveLength(1);
    expect(pending[0].recipientId).toBe(sellerId);
    expect(pending[0].bundleId).toBe(bundleId);
    expect(pending[0].chatId).toBe(chatId);
    expect(pending[0].adId).toBeUndefined();
    expect(pending[0].saleEventId).toBeUndefined();
  });

  test("does not schedule notifications when the feature flags are off", async () => {
    process.env.ENABLE_PUSH_NOTIFICATIONS = "false";
    process.env.ENABLE_EMAIL_NOTIFICATIONS = "false";
    const { t, asBuyer, bundleId } = await seedBundle();

    await asBuyer.mutation(api.bundleChats.sendBundleMessage, {
      bundleId,
      content: "Quiet mode",
    });

    const scheduled = await t.run((ctx) =>
      (ctx.db as any).system.query("_scheduled_functions").collect() as Promise<any[]>
    );
    expect(
      scheduled.find((j: any) => j.name.includes("notifyMessageReceived"))
    ).toBeUndefined();

    const pending = await t.run((ctx) =>
      ctx.db.query("pendingEmailNotifications").collect()
    );
    expect(pending).toHaveLength(0);
  });
});
