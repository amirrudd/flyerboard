// Rasterizes a blog cover SVG (public/blog-covers/*.svg) for embedding in an
// OG card. The covers bake in their own "FlyerBoard" wordmark + category
// label (top-left dot+text, bottom-left label+underline) — our card supplies
// its own chrome, so those elements are stripped before rasterizing or they
// leak into the crop as stray text fragments.
//
// Plain .mjs (not .ts): consumed by both vite.config.ts (the build-time OG
// generator) and local render harnesses, so it needs zero build step of its
// own.

import sharp from "sharp";

const STRIP_PATTERNS = [
  /<circle cx="92" cy="90"[^/]*\/>/,
  /<text x="112" y="100"[^>]*>FlyerBoard<\/text>/,
  /<text x="82" y="598"[^>]*>[^<]*<\/text>/,
  /<line x1="82" y1="620"[^/]*\/>/,
];

export function stripCoverChrome(svg) {
  return STRIP_PATTERNS.reduce((s, re) => s.replace(re, ""), svg);
}

/** Rasterizes a cover SVG to a PNG buffer at the card's photo-panel size (660×630, cover-cropped). */
export async function rasterizeCover(svgSource) {
  return sharp(Buffer.from(stripCoverChrome(svgSource)))
    .resize(660, 630, { fit: "cover" })
    .png()
    .toBuffer();
}
