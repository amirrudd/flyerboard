// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

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

  test("rejects updating a setting that doesn't exist", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t, "admin", true);
    const asAdmin = t.withIdentity({ subject: "admin" });
    await expect(
      asAdmin.mutation(api.appSettings.updateSetting, { key: "boostDailyCap", value: 5 })
    ).rejects.toThrow(/not found/i);
  });
});
