import { fromR2Reference, isR2Reference } from "./r2";

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
 */
export function resolvePublicImageUrl(
  imageRef: string | null | undefined,
  publicBase: string | undefined = import.meta.env.VITE_R2_PUBLIC_URL as string | undefined
): string | null {
  if (!imageRef) return null;

  // External URLs and data URLs never needed a server round trip.
  if (
    imageRef.startsWith("http://") ||
    imageRef.startsWith("https://") ||
    imageRef.startsWith("data:")
  ) {
    return imageRef;
  }

  if (!publicBase) return null;

  const base = publicBase.replace(/\/+$/, "");

  if (isR2Reference(imageRef)) {
    return `${base}/${fromR2Reference(imageRef)}`;
  }

  // Legacy R2 keys stored without the "r2:" prefix.
  const isLegacyR2Key =
    imageRef.includes("/") &&
    (imageRef.startsWith("flyers/") ||
      imageRef.startsWith("profiles/") ||
      imageRef.startsWith("ad/"));

  if (isLegacyR2Key) {
    return `${base}/${imageRef}`;
  }

  // Legacy Convex `_storage` IDs — no stable public URL available.
  return null;
}
