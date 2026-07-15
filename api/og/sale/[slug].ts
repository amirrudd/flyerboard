// GET /api/og/sale/:slug  →  1200×630 PNG share card for a moving sale.
//
// Referenced by <meta property="og:image"> for /sale/:slug links (wired by
// middleware.ts). Data comes from the public `saleEvents.getSaleBySlug` query
// — draft sales stay private (return null) → generic "unavailable" card.

import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api.js";
import { saleOgElement, flyerOgElement } from "../_template.js";
import { ICON_DATA_URI } from "../_icon.js";
import { publicImageUrl } from "../_imageUrl.js";
import { renderOgCard, withOgErrorHandling } from "../_render.js";

export const config = { runtime: "edge" };

const CONVEX_URL = process.env.VITE_CONVEX_URL as string;
const convex = new ConvexHttpClient(CONVEX_URL);

async function render(req: Request): Promise<Response> {
  const slug = new URL(req.url).pathname.split("/").pop() ?? "";

  const result = await convex.query(api.saleEvents.getSaleBySlug, { slug }).catch(() => null);

  const element = result
    ? saleOgElement({
        title: result.sale.title,
        suburb: result.sale.suburb,
        fromPrice: (() => {
          const prices = result.items.map((i) => i.price ?? 0).filter((p) => p > 0);
          return prices.length ? Math.min(...prices) : undefined;
        })(),
        availableCount: result.stats.available,
        totalCount: result.stats.total,
        images: result.items
          .filter((i) => i.images.length > 0)
          .slice(0, 4)
          .map((i) => publicImageUrl(i.images[0], process.env.VITE_R2_PUBLIC_URL)),
        iconDataUri: ICON_DATA_URI,
      })
    : flyerOgElement({
        title: "This sale is no longer available",
        category: "FlyerBoard",
        location: "flyerboard.com.au",
        photoUrl: null,
        iconDataUri: ICON_DATA_URI,
      });

  return renderOgCard(element, Boolean(result));
}

export default withOgErrorHandling(render);
