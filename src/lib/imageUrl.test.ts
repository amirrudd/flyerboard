import { describe, it, expect, afterEach, vi } from "vitest";
import { resolvePublicImageUrl } from "./imageUrl";

const BASE = "https://img.flyerboard.com.au";

describe("resolvePublicImageUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns null for null/undefined refs", () => {
    expect(resolvePublicImageUrl(null, BASE)).toBeNull();
    expect(resolvePublicImageUrl(undefined, BASE)).toBeNull();
  });

  it("passes through http:// URLs as-is, even without a base configured", () => {
    const url = "http://example.com/image.jpg";
    expect(resolvePublicImageUrl(url, undefined)).toBe(url);
    expect(resolvePublicImageUrl(url, BASE)).toBe(url);
  });

  it("passes through https:// URLs as-is", () => {
    const url = "https://example.com/image.jpg";
    expect(resolvePublicImageUrl(url, BASE)).toBe(url);
  });

  it("passes through data: URLs as-is", () => {
    const url = "data:image/png;base64,abc123";
    expect(resolvePublicImageUrl(url, BASE)).toBe(url);
  });

  it("resolves r2: references to a public URL when base is set", () => {
    expect(resolvePublicImageUrl("r2:flyers/post1/abc.webp", BASE)).toBe(
      `${BASE}/flyers/post1/abc.webp`
    );
  });

  it("resolves legacy flyers/ keys when base is set", () => {
    expect(resolvePublicImageUrl("flyers/post1/abc.webp", BASE)).toBe(
      `${BASE}/flyers/post1/abc.webp`
    );
  });

  it("resolves legacy profiles/ keys when base is set", () => {
    expect(resolvePublicImageUrl("profiles/user1/abc.webp", BASE)).toBe(
      `${BASE}/profiles/user1/abc.webp`
    );
  });

  it("resolves legacy ad/ keys when base is set", () => {
    expect(resolvePublicImageUrl("ad/abc.webp", BASE)).toBe(`${BASE}/ad/abc.webp`);
  });

  it("normalizes a trailing slash on the base URL", () => {
    const baseWithSlash = "https://img.flyerboard.com.au/";
    expect(resolvePublicImageUrl("r2:flyers/post1/abc.webp", baseWithSlash)).toBe(
      `${BASE}/flyers/post1/abc.webp`
    );
  });

  it("returns null for r2: references when base is unset", () => {
    // Explicitly clear the env default — .env.local may set VITE_R2_PUBLIC_URL.
    vi.stubEnv("VITE_R2_PUBLIC_URL", "");
    expect(resolvePublicImageUrl("r2:flyers/post1/abc.webp")).toBeNull();
  });

  it("returns null for legacy prefixed keys when base is unset", () => {
    vi.stubEnv("VITE_R2_PUBLIC_URL", "");
    expect(resolvePublicImageUrl("flyers/post1/abc.webp")).toBeNull();
  });

  it("returns null for legacy Convex _storage ids regardless of base", () => {
    const storageId = "kg2abc123def456";
    expect(resolvePublicImageUrl(storageId, BASE)).toBeNull();
    expect(resolvePublicImageUrl(storageId, undefined)).toBeNull();
  });

  it("returns null for a bare key with a slash but no recognized prefix", () => {
    expect(resolvePublicImageUrl("something/else.webp", BASE)).toBeNull();
  });

  it("falls back to import.meta.env.VITE_R2_PUBLIC_URL when no base param is passed", () => {
    vi.stubEnv("VITE_R2_PUBLIC_URL", BASE);
    expect(resolvePublicImageUrl("r2:flyers/post1/abc.webp")).toBe(
      `${BASE}/flyers/post1/abc.webp`
    );
  });

  it("returns null via env default when VITE_R2_PUBLIC_URL is unset", () => {
    vi.stubEnv("VITE_R2_PUBLIC_URL", "");
    expect(resolvePublicImageUrl("r2:flyers/post1/abc.webp")).toBeNull();
  });
});
