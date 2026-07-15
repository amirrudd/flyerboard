// Shared render envelope for every /api/og/* card endpoint: font loading,
// ImageResponse construction, and error handling. Extracted once a second
// handler (bundle) needed the exact same ~30 lines the ad handler already had
// — a single copy isn't worth abstracting, three would silently drift.

import { ImageResponse } from "@vercel/og";
import type { ReactElement } from "react";
import { FRAUNCES_600_B64, JAKARTA_700_B64, JAKARTA_800_B64, fontBytes } from "./_fonts.js";

// Fonts are base64-embedded, not fetched: a module-scope fetch(new URL('../fonts/
// *.ttf', import.meta.url)) rejects on the deployed edge bundle (TTFs aren't
// included), crashing every invocation with FUNCTION_INVOCATION_FAILED. Decoding
// an inlined string cannot fail that way. Decoded once per warm isolate.
const FONTS = [
  { name: "Fraunces", data: fontBytes(FRAUNCES_600_B64), weight: 600 as const, style: "normal" as const },
  { name: "Jakarta", data: fontBytes(JAKARTA_700_B64), weight: 700 as const, style: "normal" as const },
  { name: "Jakarta", data: fontBytes(JAKARTA_800_B64), weight: 800 as const, style: "normal" as const },
];

/** Cache the real card for a day (CDN absorbs share storms); cache a "not found" card only briefly, in case the content appears moments later. */
export function ogCacheControl(found: boolean): string {
  return found
    ? "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800"
    : "public, max-age=60";
}

export async function renderOgCard(element: ReactElement, found: boolean): Promise<Response> {
  return new ImageResponse(element, {
    width: 1200,
    height: 630,
    fonts: FONTS,
    headers: { "cache-control": ogCacheControl(found) },
  });
}

/** Wraps a handler so a thrown error becomes a readable 500 instead of Vercel's opaque FUNCTION_INVOCATION_FAILED page — crawlers ignore the card either way, but curl/debugging sees the cause. */
export function withOgErrorHandling(render: (req: Request) => Promise<Response>) {
  return async function handler(req: Request): Promise<Response> {
    try {
      return await render(req);
    } catch (e) {
      return new Response(`og-image render failed: ${e instanceof Error ? (e.stack ?? e.message) : String(e)}`, {
        status: 500,
        headers: { "content-type": "text/plain", "cache-control": "no-store" },
      });
    }
  };
}
