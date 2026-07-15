// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

// Same module-glob shim the other convex tests use (extglob returns [] here).
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
  subject: string
): Promise<Id<"users">> {
  return t.run((ctx) =>
    ctx.db.insert("users", { tokenIdentifier: subject, name: subject, isActive: true })
  );
}

describe("submitRating — transaction-verified, one-sided", () => {
  test("rejects rating a seller the buyer never messaged", async () => {
    const t = convexTest(schema, modules);
    const seller = await seedUser(t, "seller");
    await seedUser(t, "buyer");

    await expect(
      t.withIdentity({ subject: "buyer" }).mutation(api.ratings.submitRating, {
        ratedUserId: seller,
        rating: 5,
      })
    ).rejects.toThrow(/only rate a seller you've messaged/i);
  });

  test("allows rating once a buyer→seller thread exists", async () => {
    const t = convexTest(schema, modules);
    const seller = await seedUser(t, "seller");
    const buyer = await seedUser(t, "buyer");
    await t.run((ctx) =>
      ctx.db.insert("chats", { buyerId: buyer, sellerId: seller, lastMessageAt: 1 })
    );

    const res = await t
      .withIdentity({ subject: "buyer" })
      .mutation(api.ratings.submitRating, { ratedUserId: seller, rating: 5 });
    expect(res.success).toBe(true);

    const rating = await t.query(api.ratings.getUserRating, { userId: seller });
    expect(rating?.averageRating).toBe(5);
    expect(rating?.ratingCount).toBe(1);
  });

  test("blocks the seller from rating the buyer back (no reverse thread)", async () => {
    const t = convexTest(schema, modules);
    const seller = await seedUser(t, "seller");
    const buyer = await seedUser(t, "buyer");
    await t.run((ctx) =>
      ctx.db.insert("chats", { buyerId: buyer, sellerId: seller, lastMessageAt: 1 })
    );

    // Seller tries to rate the buyer — no thread where seller is the buyer.
    await expect(
      t.withIdentity({ subject: "seller" }).mutation(api.ratings.submitRating, {
        ratedUserId: buyer,
        rating: 1,
      })
    ).rejects.toThrow(/only rate a seller you've messaged/i);
  });
});
