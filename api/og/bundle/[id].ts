// GET /api/og/bundle/:id  →  1200×630 PNG share card for a bundle listing.
//
// Referenced by <meta property="og:image"> for /bundle/:id links (wired by
// middleware.ts). Data comes from the public `bundles.getPublicBundle` query
// (bundleId is a v.string(), not v.id() — a malformed/deleted bundle resolves
// to null, not a thrown error) → generic "unavailable" fallback card.

import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api.js";
import { bundleOgElement, flyerOgElement } from "../_template.js";
import { ICON_DATA_URI } from "../_icon.js";
import { publicImageUrl } from "../_imageUrl.js";
import { renderOgCard, withOgErrorHandling } from "../_render.js";

export const config = { runtime: "edge" };

const CONVEX_URL = process.env.VITE_CONVEX_URL as string;
const convex = new ConvexHttpClient(CONVEX_URL);

async function render(req: Request): Promise<Response> {
  const id = new URL(req.url).pathname.split("/").pop() ?? "";

  const bundle = await convex.query(api.bundles.getPublicBundle, { bundleId: id }).catch(() => null);

  // bundleOgElement always renders a price chip — correct for a real bundle
  // (every one has a price), but wrong for "not found". Reuse flyerOgElement's
  // already-chip-less unavailable look instead of teaching the template a
  // zero-price special case (same pattern as the ad handler's fallback).
  const element = bundle
    ? bundleOgElement({
        label: bundle.label,
        bundlePrice: bundle.bundlePrice,
        separatelyTotal: bundle.separatelyTotal,
        savingsPct: bundle.savingsPct,
        location: bundle.location,
        images: bundle.items.map((i) => publicImageUrl(i.image, process.env.VITE_R2_PUBLIC_URL)),
        iconDataUri: ICON_DATA_URI,
      })
    : flyerOgElement({
        title: "This bundle is no longer available",
        category: "FlyerBoard",
        location: "flyerboard.com.au",
        photoUrl: null,
        iconDataUri: ICON_DATA_URI,
      });

  return renderOgCard(element, Boolean(bundle));
}

export default withOgErrorHandling(render);
