// Server-side twin of src/lib/imageUrl.ts `resolvePublicImageUrl`, trimmed to
// what an OG card needs: turn the first stored image ref into an absolute,
// publicly-fetchable CDN URL that satori can load.
//
// Keep the legacy key prefixes ("flyers/", "profiles/", "ad/") in sync with
// src/lib/imageUrl.ts and convex/posts.ts `getImageUrl`. Legacy Convex
// `_storage` IDs have no stable public URL → return null (card shows the
// brand fallback rather than a broken image).

export function publicImageUrl(
  ref: string | null | undefined,
  publicBase: string | undefined
): string | null {
  if (!ref) return null;
  if (ref.startsWith("http://") || ref.startsWith("https://") || ref.startsWith("data:")) {
    return ref;
  }
  if (!publicBase) return null;
  const base = publicBase.replace(/\/+$/, "");

  if (ref.startsWith("r2:")) return `${base}/${ref.slice(3)}`;

  const isLegacyR2Key =
    ref.includes("/") &&
    (ref.startsWith("flyers/") || ref.startsWith("profiles/") || ref.startsWith("ad/"));
  return isLegacyR2Key ? `${base}/${ref}` : null;
}
