import { describe, it, expect } from "vitest";
import { publicImageUrl } from "./_imageUrl";
import { formatPrice } from "./_template";

const BASE = "https://img.flyerboard.com.au";

describe("publicImageUrl", () => {
  it("resolves r2: references against the CDN base", () => {
    expect(publicImageUrl("r2:flyers/1/a.webp", BASE)).toBe(`${BASE}/flyers/1/a.webp`);
  });
  it("resolves legacy bare R2 keys with known prefixes", () => {
    expect(publicImageUrl("flyers/1/a.webp", BASE)).toBe(`${BASE}/flyers/1/a.webp`);
    expect(publicImageUrl("profiles/u/a.webp", BASE)).toBe(`${BASE}/profiles/u/a.webp`);
  });
  it("passes through http(s) and data URLs untouched", () => {
    expect(publicImageUrl("https://x/y.jpg", BASE)).toBe("https://x/y.jpg");
    expect(publicImageUrl("data:image/png;base64,AA", BASE)).toBe("data:image/png;base64,AA");
  });
  it("returns null for legacy _storage IDs (no stable public URL)", () => {
    expect(publicImageUrl("kg2abc123storageid", BASE)).toBeNull();
  });
  it("returns null for empty ref or missing base", () => {
    expect(publicImageUrl(undefined, BASE)).toBeNull();
    expect(publicImageUrl("r2:flyers/1/a.webp", undefined)).toBeNull();
  });
});

describe("formatPrice", () => {
  it("groups thousands without cents", () => {
    expect(formatPrice(180)).toBe("$180");
    expect(formatPrice(1200)).toBe("$1,200");
    expect(formatPrice(1234567)).toBe("$1,234,567");
  });
});
