import { fromR2Reference, isR2Reference } from "./r2";

/**
 * Delivery-side resize tiers via Cloudflare Image Transformations
 * (`/cdn-cgi/image/...`, same mechanism as `middleware.ts` `jpegImageUrl` for
 * OG cards — see #313). Widths are ~2x the rendered CSS size so retina
 * screens stay crisp — including the mobile worst cases: `card` covers a
 * full-viewport-width image on a 390px phone at 2x, `thumb` covers a w-16
 * avatar at DPR 3; `fit=scale-down` never upscales, so a smaller original
 * (the upload pipeline already caps at 2048px, see `image-upload.md`) is
 * served as-is instead of stretched. `format=auto` picks AVIF/WebP per
 * browser. Net effect: no perceived quality loss, ~50-100x fewer bytes for
 * grid-sized cards.
 */
export type ImageSize = "thumb" | "card" | "hero" | "full";

const SIZE_TRANSFORMS: Record<ImageSize, string> = {
  thumb: "width=192,quality=82,format=auto,fit=scale-down",
  card: "width=828,quality=82,format=auto,fit=scale-down",
  hero: "width=1600,quality=85,format=auto,fit=scale-down",
  full: "width=2048,quality=90,format=auto,fit=scale-down",
};

/**
 * Resolves an image reference to a stable, publicly-cacheable URL when
 * possible — bypassing the per-mount Convex `posts.getImageUrl` query (which
 * mints a fresh presigned URL every call, defeating the browser HTTP cache).
 *
 * Backed by an R2 custom domain (Cloudflare CDN) configured via
 * `VITE_R2_PUBLIC_URL`. Until that env var is set (domain not attached yet),
 * this always returns null for R2 keys and callers fall back to the existing
 * `posts.getImageUrl` query — i.e. today's behavior is preserved byte-for-byte
 * except that http(s)/data URLs now always resolve locally.
 *
 * Legacy Convex `_storage` IDs (no `/`, no known prefix) always return null —
 * they have no stable public URL and must keep going through the query.
 *
 * Keep the legacy key prefixes ("flyers/", "profiles/", "ad/") in sync with
 * the server-side logic in convex/posts.ts `getImageUrl` (~lines 385-393).
 *
 * Pass `opts.size` to route the key through a Cloudflare Image Transformations
 * tier (requires zone Image Transformations to be enabled — see
 * `docs/guides/cloudflare-image-transformations-setup.md`). Only applies to
 * CDN keys (r2: refs and legacy-key branches); external http(s)/data URLs are
 * returned untouched regardless of `size` since they aren't served off our
 * R2 zone. Omitting `size` is byte-identical to the untransformed URL.
 */
export function resolvePublicImageUrl(
  imageRef: string | null | undefined,
  opts?: { size?: ImageSize; publicBase?: string }
): string | null {
  const publicBase = opts?.publicBase ?? (import.meta.env.VITE_R2_PUBLIC_URL as string | undefined);

  if (!imageRef) return null;

  // External URLs and data URLs never needed a server round trip, and are
  // never eligible for the CDN resize transform (not served off our zone).
  if (
    imageRef.startsWith("http://") ||
    imageRef.startsWith("https://") ||
    imageRef.startsWith("data:")
  ) {
    return imageRef;
  }

  if (!publicBase) return null;

  const base = publicBase.replace(/\/+$/, "");
  const size = opts?.size;

  if (isR2Reference(imageRef)) {
    const key = fromR2Reference(imageRef);
    return size ? `${base}/cdn-cgi/image/${SIZE_TRANSFORMS[size]}/${key}` : `${base}/${key}`;
  }

  // Legacy R2 keys stored without the "r2:" prefix.
  const isLegacyR2Key =
    imageRef.includes("/") &&
    (imageRef.startsWith("flyers/") ||
      imageRef.startsWith("profiles/") ||
      imageRef.startsWith("ad/"));

  if (isLegacyR2Key) {
    return size ? `${base}/cdn-cgi/image/${SIZE_TRANSFORMS[size]}/${imageRef}` : `${base}/${imageRef}`;
  }

  // Legacy Convex `_storage` IDs — no stable public URL available.
  return null;
}
