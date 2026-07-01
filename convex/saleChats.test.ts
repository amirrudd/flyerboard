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

/**
 * Build a published/active sale owned by seller "A" with one item, plus a
 * buyer "B". Returns handles + ids.
 */
async function seedPublishedSale() {
  const t = convexTest(schema, modules);
  const sellerId = await seedUser(t, "A", "Seller");
  const buyerId = await seedUser(t, "B", "Buyer");
  await t.run((ctx) =>
    ctx.db.insert("categories", { name: "Other", slug: "other" })
  );
  const asSeller = t.withIdentity({ subject: "A" });
  const asBuyer = t.withIdentity({ subject: "B" });

  const start = Date.now() + DAY;
  const saleId = await asSeller.mutation(api.saleEvents.createSaleEvent, {
    title: "Seller's Sale",
    suburb: "Carlton, VIC",
    pickupWindowStart: start,
    pickupWindowEnd: start + 2 * HOUR,
  });
  const itemIds = (await asSeller.mutation(api.saleEvents.addSaleItems, {
    saleEventId: saleId,
    items: [{ imageKey: "r2:a", title: "Chair", price: 20 }],
  }));
  await asSeller.mutation(api.saleEvents.publishSaleEvent, {
    saleEventId: saleId,
  });

  return { t, asSeller, asBuyer, sellerId, buyerId, saleId, itemIds };
}

// ──────────────────────────────────────────────────────────────────────────
// sendSaleMessage
// ──────────────────────────────────────────────────────────────────────────
describe("sendSaleMessage", () => {
  test("throws when unauthenticated", async () => {
    const { t, saleId } = await seedPublishedSale();
    await expect(
      t.mutation(api.saleChats.sendSaleMessage, {
        saleEventId: saleId,
        content: "hi",
      })
    ).rejects.toThrow(/logged in/i);
  });

  test("seller cannot message their own sale", async () => {
    const { asSeller, saleId } = await seedPublishedSale();
    await expect(
      asSeller.mutation(api.saleChats.sendSaleMessage, {
        saleEventId: saleId,
        content: "hi",
      })
    ).rejects.toThrow(/your own sale/i);
  });

  test("rejects empty content", async () => {
    const { asBuyer, saleId } = await seedPublishedSale();
    await expect(
      asBuyer.mutation(api.saleChats.sendSaleMessage, {
        saleEventId: saleId,
        content: "   ",
      })
    ).rejects.toThrow(/empty/i);
  });

  test("reuses one chat per buyer per sale across multiple sends", async () => {
    const { t, asBuyer, saleId } = await seedPublishedSale();
    const first = await asBuyer.mutation(api.saleChats.sendSaleMessage, {
      saleEventId: saleId,
      content: "Is the chair available?",
    });
    const second = await asBuyer.mutation(api.saleChats.sendSaleMessage, {
      saleEventId: saleId,
      content: "Still around?",
    });
    expect(second.chatId).toBe(first.chatId);

    const chats = await t.run((ctx) =>
      ctx.db
        .query("chats")
        .withIndex("by_sale_event_buyer", (q) =>
          q.eq("saleEventId", saleId)
        )
        .collect()
    );
    expect(chats).toHaveLength(1);

    const messages = await t.run((ctx) =>
      ctx.db
        .query("messages")
        .withIndex("by_chat", (q) => q.eq("chatId", first.chatId))
        .collect()
    );
    expect(messages).toHaveLength(2);
  });

  test("filters referencedAdIds to ads belonging to the sale", async () => {
    const { t, asBuyer, saleId, itemIds } = await seedPublishedSale();
    // A foreign ad not belonging to this sale.
    const foreignAd = await t.run(async (ctx) =>
      ctx.db.insert("ads", {
        title: "Foreign",
        description: "",
        location: "X",
        categoryId: (await ctx.db.query("categories").first())!._id,
        images: ["r2:f"],
        userId: (await ctx.db.query("users").first())!._id,
        isActive: true,
        views: 0,
      })
    );
    const { chatId } = await asBuyer.mutation(api.saleChats.sendSaleMessage, {
      saleEventId: saleId,
      content: "Can I get this one?",
      referencedAdIds: [foreignAd, itemIds[0]],
    });
    const msg = await t.run((ctx) =>
      ctx.db
        .query("messages")
        .withIndex("by_chat", (q) => q.eq("chatId", chatId))
        .first()
    );
    expect(msg!.referencedAdIds).toEqual([itemIds[0]]);
    expect(msg!.referencedAdIds).not.toContain(foreignAd);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// getSaleThread
// ──────────────────────────────────────────────────────────────────────────
describe("getSaleThread", () => {
  test("returns null when unauthenticated", async () => {
    const { t, saleId } = await seedPublishedSale();
    const res = await t.query(api.saleChats.getSaleThread, {
      saleEventId: saleId,
    });
    expect(res).toBeNull();
  });

  test("returns empty thread before any message", async () => {
    const { asBuyer, saleId } = await seedPublishedSale();
    const res = await asBuyer.query(api.saleChats.getSaleThread, {
      saleEventId: saleId,
    });
    expect(res).toEqual({ chatId: null, messages: [] });
  });

  test("returns messages with mine:true for the sender and the chips", async () => {
    const { asBuyer, saleId, itemIds } = await seedPublishedSale();
    await asBuyer.mutation(api.saleChats.sendSaleMessage, {
      saleEventId: saleId,
      content: "Hello there",
      referencedAdIds: [itemIds[0]],
    });
    const res = await asBuyer.query(api.saleChats.getSaleThread, {
      saleEventId: saleId,
    });
    expect(res).not.toBeNull();
    expect(res!.chatId).not.toBeNull();
    expect(res!.messages).toHaveLength(1);
    expect(res!.messages[0].content).toBe("Hello there");
    expect(res!.messages[0].mine).toBe(true);
    expect(res!.messages[0].referencedAdIds).toEqual([itemIds[0]]);
  });
});
