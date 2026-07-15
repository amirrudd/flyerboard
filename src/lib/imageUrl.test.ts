import { describe, it, expect, afterEach, vi } from "vitest";
import { resolvePublicImageUrl } from "./imageUrl";

const BASE = "https://img.flyerboard.com.au";

describe("resolvePublicImageUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns null for null/undefined refs", () => {
    expect(resolvePublicImageUrl(null, { publicBase: BASE })).toBeNull();
    expect(resolvePublicImageUrl(undefined, { publicBase: BASE })).toBeNull();
  });

  it("passes through http:// URLs as-is, even without a base configured", () => {
    const url = "http://example.com/image.jpg";
    expect(resolvePublicImageUrl(url, { publicBase: undefined })).toBe(url);
    expect(resolvePublicImageUrl(url, { publicBase: BASE })).toBe(url);
  });

  it("passes through https:// URLs as-is", () => {
    const url = "https://example.com/image.jpg";
    expect(resolvePublicImageUrl(url, { publicBase: BASE })).toBe(url);
  });

  it("passes through data: URLs as-is", () => {
    const url = "data:image/png;base64,abc123";
    expect(resolvePublicImageUrl(url, { publicBase: BASE })).toBe(url);
  });

  it("resolves r2: references to a public URL when base is set", () => {
    expect(resolvePublicImageUrl("r2:flyers/post1/abc.webp", { publicBase: BASE })).toBe(
      `${BASE}/flyers/post1/abc.webp`
    );
  });

  it("resolves legacy flyers/ keys when base is set", () => {
    expect(resolvePublicImageUrl("flyers/post1/abc.webp", { publicBase: BASE })).toBe(
      `${BASE}/flyers/post1/abc.webp`
    );
  });

  it("resolves legacy profiles/ keys when base is set", () => {
    expect(resolvePublicImageUrl("profiles/user1/abc.webp", { publicBase: BASE })).toBe(
      `${BASE}/profiles/user1/abc.webp`
    );
  });

  it("resolves legacy ad/ keys when base is set", () => {
    expect(resolvePublicImageUrl("ad/abc.webp", { publicBase: BASE })).toBe(`${BASE}/ad/abc.webp`);
  });

  it("normalizes a trailing slash on the base URL", () => {
    const baseWithSlash = "https://img.flyerboard.com.au/";
    expect(resolvePublicImageUrl("r2:flyers/post1/abc.webp", { publicBase: baseWithSlash })).toBe(
      `${BASE}/flyers/post1/abc.webp`
    );
  });

  // NB: pass an explicit empty base, NOT `undefined`. Passing `undefined` triggers
  // the parameter default (`import.meta.env.VITE_R2_PUBLIC_URL`), which Vite now
  // injects from .env.local (the CDN went live), so the "unset" case wouldn't be
  // exercised. An empty string hits the same `if (!publicBase) return null` branch.
  it("returns null for r2: references when base is unset", () => {
    expect(resolvePublicImageUrl("r2:flyers/post1/abc.webp", { publicBase: "" })).toBeNull();
  });

  it("returns null for legacy prefixed keys when base is unset", () => {
    expect(resolvePublicImageUrl("flyers/post1/abc.webp", { publicBase: "" })).toBeNull();
  });

  it("returns null for legacy Convex _storage ids regardless of base", () => {
    const storageId = "kg2abc123def456";
    expect(resolvePublicImageUrl(storageId, { publicBase: BASE })).toBeNull();
    expect(resolvePublicImageUrl(storageId, { publicBase: undefined })).toBeNull();
  });

  it("returns null for a bare key with a slash but no recognized prefix", () => {
    expect(resolvePublicImageUrl("something/else.webp", { publicBase: BASE })).toBeNull();
  });

  it("falls back to import.meta.env.VITE_R2_PUBLIC_URL when no base opt is passed", () => {
    vi.stubEnv("VITE_R2_PUBLIC_URL", BASE);
    expect(resolvePublicImageUrl("r2:flyers/post1/abc.webp")).toBe(
      `${BASE}/flyers/post1/abc.webp`
    );
  });

  it("returns null via env default when VITE_R2_PUBLIC_URL is unset", () => {
    vi.stubEnv("VITE_R2_PUBLIC_URL", "");
    expect(resolvePublicImageUrl("r2:flyers/post1/abc.webp")).toBeNull();
  });

  describe("size tiers", () => {
    it("applies the thumb transform to r2: refs", () => {
      expect(
        resolvePublicImageUrl("r2:flyers/post1/abc.webp", { size: "thumb", publicBase: BASE })
      ).toBe(`${BASE}/cdn-cgi/image/width=192,quality=82,format=auto,fit=scale-down/flyers/post1/abc.webp`);
    });

    it("applies the card transform to r2: refs", () => {
      expect(
        resolvePublicImageUrl("r2:flyers/post1/abc.webp", { size: "card", publicBase: BASE })
      ).toBe(`${BASE}/cdn-cgi/image/width=828,quality=82,format=auto,fit=scale-down/flyers/post1/abc.webp`);
    });

    it("applies the hero transform to r2: refs", () => {
      expect(
        resolvePublicImageUrl("r2:flyers/post1/abc.webp", { size: "hero", publicBase: BASE })
      ).toBe(`${BASE}/cdn-cgi/image/width=1600,quality=85,format=auto,fit=scale-down/flyers/post1/abc.webp`);
    });

    it("applies the full transform to r2: refs", () => {
      expect(
        resolvePublicImageUrl("r2:flyers/post1/abc.webp", { size: "full", publicBase: BASE })
      ).toBe(`${BASE}/cdn-cgi/image/width=2048,quality=90,format=auto,fit=scale-down/flyers/post1/abc.webp`);
    });

    it("applies the transform to legacy keys too", () => {
      expect(
        resolvePublicImageUrl("flyers/post1/abc.webp", { size: "card", publicBase: BASE })
      ).toBe(`${BASE}/cdn-cgi/image/width=828,quality=82,format=auto,fit=scale-down/flyers/post1/abc.webp`);
      expect(
        resolvePublicImageUrl("profiles/user1/abc.webp", { size: "thumb", publicBase: BASE })
      ).toBe(`${BASE}/cdn-cgi/image/width=192,quality=82,format=auto,fit=scale-down/profiles/user1/abc.webp`);
    });

    it("never applies a transform to external or data URLs, even with size set", () => {
      const httpUrl = "https://example.com/image.jpg";
      const dataUrl = "data:image/png;base64,abc123";
      expect(resolvePublicImageUrl(httpUrl, { size: "card", publicBase: BASE })).toBe(httpUrl);
      expect(resolvePublicImageUrl(dataUrl, { size: "card", publicBase: BASE })).toBe(dataUrl);
    });

    it("returns null when size is set but no publicBase is available", () => {
      expect(
        resolvePublicImageUrl("r2:flyers/post1/abc.webp", { size: "card", publicBase: "" })
      ).toBeNull();
    });
  });
});
