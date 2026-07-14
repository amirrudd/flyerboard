// GET /api/og/ad/:id  →  1200×630 PNG share card for a flyer.
//
// Referenced by <meta property="og:image"> for /ad/:id links (wired by
// middleware.ts). Runs on the Vercel edge runtime; @vercel/og bundles
// satori + resvg-wasm. Data comes from the public `adDetail.getAdById`
// query — no auth, soft-deleted ads return null → generic 404 card.

import { ImageResponse } from "@vercel/og";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api.js";
import type { Id } from "../../../convex/_generated/dataModel.js";
import { flyerOgElement } from "../_template.js";
import { ICON_DATA_URI } from "../_icon.js";
import { publicImageUrl } from "../_imageUrl.js";
import { FRAUNCES_600_B64, JAKARTA_700_B64, JAKARTA_800_B64, fontBytes } from "../_fonts.js";

export const config = { runtime: "edge" };

const CONVEX_URL = process.env.VITE_CONVEX_URL as string;
// Hoisted to module scope: the client is stateless config, and the fonts are
// static — a warm edge isolate decodes them once instead of once per request.
// Fonts are base64-embedded (_fonts.ts): the previous fetch(new URL('../fonts/
// *.ttf', import.meta.url)) rejected on the deployed edge runtime (the TTF
// assets weren't bundled), which crashed module init on every invocation
// (FUNCTION_INVOCATION_FAILED) — decoding an inlined string cannot fail that way.
const convex = new ConvexHttpClient(CONVEX_URL);
const FONTS = [
  { name: "Fraunces", data: fontBytes(FRAUNCES_600_B64), weight: 600 as const, style: "normal" as const },
  { name: "Jakarta", data: fontBytes(JAKARTA_700_B64), weight: 700 as const, style: "normal" as const },
  { name: "Jakarta", data: fontBytes(JAKARTA_800_B64), weight: 800 as const, style: "normal" as const },
];

export default async function handler(req: Request): Promise<Response> {
  try {
    return await render(req);
  } catch (e) {
    // A readable 500 beats Vercel's opaque FUNCTION_INVOCATION_FAILED page —
    // crawlers ignore the card either way, but curl/debugging sees the cause.
    return new Response(`og-image render failed: ${e instanceof Error ? e.stack ?? e.message : String(e)}`, {
      status: 500,
      headers: { "content-type": "text/plain", "cache-control": "no-store" },
    });
  }
}

async function render(req: Request): Promise<Response> {
  const id = new URL(req.url).pathname.split("/").pop() ?? "";

  const fonts = FONTS;
  const [ad, categories] = await Promise.all([
    convex.query(api.adDetail.getAdById, { adId: id as Id<"ads"> }).catch(() => null),
    convex.query(api.categories.getCategories, {}).catch(() => []),
  ]);

  const element = flyerOgElement(
    ad
      ? {
          title: ad.title,
          price: ad.price,
          exchange: ad.listingType === "exchange",
          category: categories.find((c) => c._id === ad.categoryId)?.name ?? "For sale",
          location: ad.location,
          photoUrl: publicImageUrl(ad.images?.[0], process.env.VITE_R2_PUBLIC_URL),
          iconDataUri: ICON_DATA_URI,
        }
      : {
          title: "This listing is no longer available",
          category: "FlyerBoard",
          location: "flyerboard.com.au",
          photoUrl: null,
          iconDataUri: ICON_DATA_URI,
        }
  );

  return new ImageResponse(element, {
    width: 1200,
    height: 630,
    fonts,
    headers: {
      // Fresh enough that a re-listed/edited ad's card updates within the hour,
      // but the CDN absorbs share storms. ad missing → don't cache the 404 card long.
      "cache-control": ad
        ? "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800"
        : "public, max-age=60",
    },
  });
}
