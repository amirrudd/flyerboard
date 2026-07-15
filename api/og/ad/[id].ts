// GET /api/og/ad/:id  →  1200×630 PNG share card for a flyer.
//
// Referenced by <meta property="og:image"> for /ad/:id links (wired by
// middleware.ts). Runs on the Vercel edge runtime; @vercel/og bundles
// satori + resvg-wasm. Data comes from the public `adDetail.getAdById`
// query — no auth, soft-deleted ads return null → generic 404 card.

import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api.js";
import type { Id } from "../../../convex/_generated/dataModel.js";
import { flyerOgElement } from "../_template.js";
import { ICON_DATA_URI } from "../_icon.js";
import { publicImageUrl } from "../_imageUrl.js";
import { renderOgCard, withOgErrorHandling } from "../_render.js";

export const config = { runtime: "edge" };

const CONVEX_URL = process.env.VITE_CONVEX_URL as string;
const convex = new ConvexHttpClient(CONVEX_URL);

async function render(req: Request): Promise<Response> {
  const id = new URL(req.url).pathname.split("/").pop() ?? "";

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

  return renderOgCard(element, Boolean(ad));
}

export default withOgErrorHandling(render);
