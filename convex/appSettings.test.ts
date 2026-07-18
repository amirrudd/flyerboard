// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { checkRateLimit } from "./lib/rateLimit";

// Load all Convex modules so convex-test can run them (same glob approach as
// boost.test.ts — extglob returns [] under this repo's vitest setup).
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
  isAdmin: boolean
): Promise<Id<"users">> {
  return t.run(async (ctx) =>
    ctx.db.insert("users", {
      tokenIdentifier: subject,
      name: isAdmin ? "Admin" : "User",
      isActive: true,
      isAdmin,
    })
  );
}

async function setSetting(
  t: ReturnType<typeof convexTest>,
  key: string,
  value: number
): Promise<void> {
  await t.run((ctx) => ctx.db.insert("appSettings", { key, value, description: "test" }));
}

describe("appSettings.getSetting (public)", () => {
  test("returns the stored value with no auth", async () => {
    const t = convexTest(schema, modules);
    await setSetting(t, "boostCooldownDays", 7);
    const value = await t.query(api.appSettings.getSetting, { key: "boostCooldownDays" });
    expect(value).toBe(7);
  });

  test("returns null for a missing key", async () => {
    const t = convexTest(schema, modules);
    const value = await t.query(api.appSettings.getSetting, { key: "nope" });
    expect(value).toBeNull();
  });

  test("clamps an out-of-range stored value on read", async () => {
    const t = convexTest(schema, modules);
    // A raw value seeded directly (bypassing updateSetting's validation) must still
    // read back clamped to the valid range.
    await setSetting(t, "boostCooldownDays", 999); // > 30
    await setSetting(t, "boostDailyCap", 0); // < 1
    expect(await t.query(api.appSettings.getSetting, { key: "boostCooldownDays" })).toBe(30);
    expect(await t.query(api.appSettings.getSetting, { key: "boostDailyCap" })).toBe(1);
  });
});

describe("appSettings.getAllSettings (admin-only)", () => {
  test("rejects a non-admin", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t, "u1", false);
    const asUser = t.withIdentity({ subject: "u1" });
    await expect(asUser.query(api.appSettings.getAllSettings, {})).rejects.toThrow(/admin/i);
  });

  test("returns all settings for an admin", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t, "admin", true);
    await setSetting(t, "boostCooldownDays", 7);
    await setSetting(t, "boostDailyCap", 3);
    const asAdmin = t.withIdentity({ subject: "admin" });
    const all = await asAdmin.query(api.appSettings.getAllSettings, {});
    expect(all).toHaveLength(2);
  });
});

describe("appSettings.updateSetting (admin-only)", () => {
  test("rejects a non-admin", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t, "u1", false);
    await setSetting(t, "boostCooldownDays", 7);
    const asUser = t.withIdentity({ subject: "u1" });
    await expect(
      asUser.mutation(api.appSettings.updateSetting, { key: "boostCooldownDays", value: 10 })
    ).rejects.toThrow(/admin/i);
  });

  test("updates an in-range value", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t, "admin", true);
    await setSetting(t, "boostCooldownDays", 7);
    const asAdmin = t.withIdentity({ subject: "admin" });
    const res = await asAdmin.mutation(api.appSettings.updateSetting, {
      key: "boostCooldownDays",
      value: 14,
    });
    expect(res.success).toBe(true);
    expect(await t.query(api.appSettings.getSetting, { key: "boostCooldownDays" })).toBe(14);
  });

  test("rejects an out-of-range value (cooldown > 30)", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t, "admin", true);
    await setSetting(t, "boostCooldownDays", 7);
    const asAdmin = t.withIdentity({ subject: "admin" });
    await expect(
      asAdmin.mutation(api.appSettings.updateSetting, { key: "boostCooldownDays", value: 31 })
    ).rejects.toThrow(/out of range/i);
    // Unchanged.
    expect(await t.query(api.appSettings.getSetting, { key: "boostCooldownDays" })).toBe(7);
  });

  test("rejects an out-of-range daily cap (> 20)", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t, "admin", true);
    await setSetting(t, "boostDailyCap", 3);
    const asAdmin = t.withIdentity({ subject: "admin" });
    await expect(
      asAdmin.mutation(api.appSettings.updateSetting, { key: "boostDailyCap", value: 21 })
    ).rejects.toThrow(/out of range/i);
  });

  test("rejects an UNKNOWN key that has no row (no blind insert)", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t, "admin", true);
    const asAdmin = t.withIdentity({ subject: "admin" });
    await expect(
      asAdmin.mutation(api.appSettings.updateSetting, { key: "totallyUnknown", value: 5 })
    ).rejects.toThrow(/not found/i);
  });

  test("upserts a KNOWN key with no row (sparse rate-limit convention)", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t, "admin", true);
    const asAdmin = t.withIdentity({ subject: "admin" });
    const res = await asAdmin.mutation(api.appSettings.updateSetting, {
      key: "boostDailyCap",
      value: 5,
    });
    expect(res.success).toBe(true);
    expect(await t.query(api.appSettings.getSetting, { key: "boostDailyCap" })).toBe(5);
  });

  test("validates bounds for the new non-boost keys", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t, "admin", true);
    const asAdmin = t.withIdentity({ subject: "admin" });

    // bundleMaxItems: 2–10
    await expect(
      asAdmin.mutation(api.appSettings.updateSetting, { key: "bundleMaxItems", value: 11 })
    ).rejects.toThrow(/out of range/i);
    await expect(
      asAdmin.mutation(api.appSettings.updateSetting, { key: "bundleMaxItems", value: 1 })
    ).rejects.toThrow(/out of range/i);
    expect(
      (await asAdmin.mutation(api.appSettings.updateSetting, { key: "bundleMaxItems", value: 6 }))
        .success
    ).toBe(true);

    // saleMaxItems: 10–500
    await expect(
      asAdmin.mutation(api.appSettings.updateSetting, { key: "saleMaxItems", value: 501 })
    ).rejects.toThrow(/out of range/i);

    // saleExpiryBufferDays: 0–14 (0 is valid)
    expect(
      (
        await asAdmin.mutation(api.appSettings.updateSetting, {
          key: "saleExpiryBufferDays",
          value: 0,
        })
      ).success
    ).toBe(true);

    // feed member caps: 0–10
    await expect(
      asAdmin.mutation(api.appSettings.updateSetting, { key: "feedSaleMemberCap", value: 11 })
    ).rejects.toThrow(/out of range/i);
  });

  test("validates rate-limit override bounds: [1, 4× static default]", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t, "admin", true);
    const asAdmin = t.withIdentity({ subject: "admin" });

    // createAd static default is 10 → allowed range 1–40.
    await expect(
      asAdmin.mutation(api.appSettings.updateSetting, { key: "rateLimitMax_createAd", value: 41 })
    ).rejects.toThrow(/out of range/i);
    await expect(
      asAdmin.mutation(api.appSettings.updateSetting, { key: "rateLimitMax_createAd", value: 0 })
    ).rejects.toThrow(/out of range/i);
    const res = await asAdmin.mutation(api.appSettings.updateSetting, {
      key: "rateLimitMax_createAd",
      value: 40,
    });
    expect(res.success).toBe(true);
    expect(await t.query(api.appSettings.getSetting, { key: "rateLimitMax_createAd" })).toBe(40);
  });
});

// ── checkRateLimit × appSettings override (rateLimitMax_<op>) ────────────────────
// checkRateLimit only touches ctx.db, so t.run's ctx is a valid stand-in.
describe("checkRateLimit rate-limit overrides", () => {
  async function hit(
    t: ReturnType<typeof convexTest>,
    userId: Id<"users">,
    op: string
  ): Promise<void> {
    await t.run((ctx) => checkRateLimit(ctx as unknown as MutationCtx, userId, op));
  }

  test("missing override row → static default applies (createReport = 5/hour)", async () => {
    const t = convexTest(schema, modules);
    const userId = await seedUser(t, "u1", false);
    for (let i = 0; i < 5; i++) await hit(t, userId, "createReport");
    await expect(hit(t, userId, "createReport")).rejects.toThrow(/rate limit/i);
  });

  test("appSettings row overrides maxRequests (createReport → 2)", async () => {
    const t = convexTest(schema, modules);
    const userId = await seedUser(t, "u1", false);
    await setSetting(t, "rateLimitMax_createReport", 2);
    await hit(t, userId, "createReport");
    await hit(t, userId, "createReport");
    await expect(hit(t, userId, "createReport")).rejects.toThrow(/rate limit/i);
  });

  test("out-of-clamp row is clamped, not obeyed (0 → min 1; 999 → 4× default)", async () => {
    const t = convexTest(schema, modules);
    const userId = await seedUser(t, "u1", false);
    // Below min: 0 clamps to 1 — second call must throw.
    await setSetting(t, "rateLimitMax_createReport", 0);
    await hit(t, userId, "createReport");
    await expect(hit(t, userId, "createReport")).rejects.toThrow(/rate limit/i);

    // Above max: 999 clamps to 20 (4 × static default 5) for a fresh user.
    const userB = await seedUser(t, "u2", false);
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query("appSettings")
        .withIndex("by_key", (q) => q.eq("key", "rateLimitMax_createReport"))
        .first();
      await ctx.db.patch(row!._id, { value: 999 });
    });
    for (let i = 0; i < 20; i++) await hit(t, userB, "createReport");
    await expect(hit(t, userB, "createReport")).rejects.toThrow(/rate limit/i);
  });

  test("boostAd ignores any override row (deliberate static backstop)", async () => {
    const t = convexTest(schema, modules);
    const userId = await seedUser(t, "u1", false);
    await setSetting(t, "rateLimitMax_boostAd", 1);
    // Static backstop is 20/day — a would-be override of 1 must NOT apply.
    await hit(t, userId, "boostAd");
    await hit(t, userId, "boostAd"); // would throw if the override were honoured
  });
});
