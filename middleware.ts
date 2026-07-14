// Vercel Edge Middleware — per-listing/-post social meta for shared links.
//
// The app is a client-rendered SPA: vercel.json rewrites every path to
// index.html, and the per-page <meta> tags in BlogPostPage/AdDetail only exist
// AFTER React runs. Social crawlers (iMessage, Slack, X, Facebook, LinkedIn,
// WhatsApp) don't run JS, so without this they'd see index.html's generic tags
// and a 404 og-preview.png. This middleware intercepts the crawlable routes,
// fetches the static shell, and injects real Open Graph tags into <head>.
//
// It runs before the static file is served (matcher below), does one Convex
// read for /ad/:id, and returns the same SPA HTML — humans get an identical app
// shell, just with correct head tags.

import { next } from "@vercel/edge";
import { ConvexHttpClient } from "convex/browser";
import { api } from "./convex/_generated/api.js";
import type { Id } from "./convex/_generated/dataModel.js";

export const config = {
  // Only crawlable content routes. Everything else serves statically untouched.
  // NOTE: this matcher and the route regexes in `resolveMeta` must stay in sync —
  // adding a type (e.g. /blog/:slug with its build-time meta map) means editing both.
  matcher: ["/ad/:id"],
};

const CONVEX_URL = process.env.VITE_CONVEX_URL as string;
const SITE = "https://flyerboard.com.au";
// Module scope: stateless config, reused across a warm isolate.
const convex = new ConvexHttpClient(CONVEX_URL);

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

interface Meta {
  title: string;
  description: string;
  image: string;
  url: string;
  type: "article" | "website";
}

async function resolveMeta(pathname: string, origin: string): Promise<Meta | null> {
  const adMatch = pathname.match(/^\/ad\/([^/]+)$/);
  if (adMatch) {
    const id = adMatch[1];
    const ad = await convex
      .query(api.adDetail.getAdById, { adId: id as Id<"ads"> })
      .catch(() => null);
    if (!ad) return null;
    const priced = ad.price !== undefined && ad.price !== null;
    return {
      title: `${ad.title}${priced ? ` — $${ad.price}` : ""} | FlyerBoard`,
      description: ad.description?.slice(0, 200) || "See this listing on FlyerBoard — your local marketplace.",
      image: `${origin}/api/og/ad/${id}`,
      url: `${SITE}/ad/${id}`,
      type: "article",
    };
  }

  return null;
}

function tags(m: Meta): string {
  return [
    `<meta property="og:type" content="${m.type}" />`,
    `<meta property="og:title" content="${esc(m.title)}" />`,
    `<meta property="og:description" content="${esc(m.description)}" />`,
    `<meta property="og:url" content="${m.url}" />`,
    `<meta property="og:image" content="${m.image}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(m.title)}" />`,
    `<meta name="twitter:description" content="${esc(m.description)}" />`,
    `<meta name="twitter:image" content="${m.image}" />`,
  ].join("");
}

export default async function middleware(req: Request): Promise<Response> {
  const url = new URL(req.url);

  // The meta lookup (a Convex round trip) and the SPA shell fetch are
  // independent, so run them concurrently. On a dead link we discard the shell,
  // but the matcher is hit mostly by crawlers on real listings — saving one RTT
  // on every valid share preview outweighs the rare wasted fetch.
  // (matcher excludes /index.html, so fetching it here can't loop.)
  const [meta, shell] = await Promise.all([
    resolveMeta(url.pathname, url.origin),
    fetch(new URL("/index.html", url.origin)),
  ]);
  if (!meta) return next();

  let html = await shell.text();

  // Replace the generic <title> and strip index.html's default og:image so ours
  // is the only one, then inject the resolved tags right before </head>.
  html = html
    .replace(/<title>.*?<\/title>/, `<title>${esc(meta.title)}</title>`)
    .replace(/<meta property="og:image"[^>]*>/g, "")
    .replace("</head>", `${tags(meta)}</head>`);

  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      // Short CDN cache; the og:image itself is cached hard at its own endpoint.
      "cache-control": "public, max-age=0, s-maxage=300, stale-while-revalidate=3600",
    },
  });
}
