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

export const config = { runtime: "edge" };

const CONVEX_URL = process.env.VITE_CONVEX_URL as string;
// Hoisted to module scope: the client is stateless config, and the fonts are
// static — a warm edge isolate loads them once instead of once per request.
const convex = new ConvexHttpClient(CONVEX_URL);
const font = (path: string) => fetch(new URL(path, import.meta.url)).then((r) => r.arrayBuffer());
const fontsPromise = Promise.all([
  font("../fonts/Fraunces-600.ttf").then((data) => ({ name: "Fraunces", data, weight: 600 as const, style: "normal" as const })),
  font("../fonts/Jakarta-700.ttf").then((data) => ({ name: "Jakarta", data, weight: 700 as const, style: "normal" as const })),
  font("../fonts/Jakarta-800.ttf").then((data) => ({ name: "Jakarta", data, weight: 800 as const, style: "normal" as const })),
]);

export default async function handler(req: Request): Promise<Response> {
  const id = new URL(req.url).pathname.split("/").pop() ?? "";

  const [fonts, ad, categories] = await Promise.all([
    fontsPromise,
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
