// Build-time OG asset generator. Run via `tsx` as its own build step, chained
// AFTER `vite build` (see package.json's "build" script) — deliberately NOT a
// Vite plugin hook: writeBundle runs inside Vite's own Node process, which has
// no general TS loader active beyond vite.config.ts's own static import graph,
// so a dynamically-imported .ts file there is not reliably resolvable. Running
// this as an explicit `tsx` step is the same proven mechanism used throughout
// this project's local verification harnesses, and is directly testable on
// its own (`npx tsx scripts/generate-og-assets.mts dist`).
//
// Blog posts are static markdown bundled into the SPA at build time — they
// aren't reachable from api/og/* (a separately-bundled edge function) or from
// middleware.ts (compiled independently, no filesystem access at request
// time). So instead of a runtime render, this renders every post's OG card
// AHEAD of time into dist/blog-og/<slug>.png, and writes dist/blog-meta.json
// — a small static file middleware.ts self-fetches at request time (the same
// proven pattern it already uses to fetch /index.html) to build the per-post
// <meta> tags. Also renders the default brand card to dist/og-preview.png,
// fixing the site-wide 404 fallback.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ImageResponse } from "@vercel/og";
import type { ReactElement } from "react";
import { parseFrontmatter } from "../src/lib/frontmatter.ts";
import { blogOgElement, brandOgElement } from "../api/og/_template.ts";
import { ICON_DATA_URI } from "../api/og/_icon.ts";
import { rasterizeCover } from "./blog-cover-og.mjs";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const BLOG_DIR = path.join(ROOT, "src/content/blog");
const COVERS_DIR = path.join(ROOT, "public/blog-covers");
const FONTS_DIR = path.join(ROOT, "api/og/fonts");

const str = (v: string | string[] | undefined): string => (typeof v === "string" ? v : "");

function loadFonts() {
  const f = (name: string) => fs.readFileSync(path.join(FONTS_DIR, name));
  return [
    { name: "Fraunces", data: f("Fraunces-600.ttf"), weight: 600 as const, style: "normal" as const },
    { name: "Jakarta", data: f("Jakarta-700.ttf"), weight: 700 as const, style: "normal" as const },
    { name: "Jakarta", data: f("Jakarta-800.ttf"), weight: 800 as const, style: "normal" as const },
  ];
}

function loadPosts() {
  if (!fs.existsSync(BLOG_DIR)) return [];
  return fs
    .readdirSync(BLOG_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((file) => {
      const { data } = parseFrontmatter(fs.readFileSync(path.join(BLOG_DIR, file), "utf-8"));
      const slug = str(data.slug) || file.replace(/\.md$/, "");
      const heroImage = str(data.heroImage);
      return {
        slug,
        title: str(data.title) || slug,
        description: str(data.description),
        category: str(data.category) || "Guides",
        readingTime: Number(str(data.readingTime)) || 5,
        // Only /blog-covers/*.svg is a known-rasterizable local asset — an
        // external or non-SVG heroImage falls back to the brand mark.
        coverFile: heroImage.startsWith("/blog-covers/") && heroImage.endsWith(".svg")
          ? path.join(COVERS_DIR, path.basename(heroImage))
          : null,
      };
    });
}

export async function generateOgAssets(outDir: string) {
  const fonts = loadFonts();
  const render = async (element: ReactElement) =>
    Buffer.from(await new ImageResponse(element, { width: 1200, height: 630, fonts }).arrayBuffer());

  const posts = loadPosts();
  const ogDir = path.join(outDir, "blog-og");
  fs.mkdirSync(ogDir, { recursive: true });

  const meta: { slug: string; title: string; description: string }[] = [];
  for (const post of posts) {
    const coverDataUri = post.coverFile && fs.existsSync(post.coverFile)
      ? "data:image/png;base64," + (await rasterizeCover(fs.readFileSync(post.coverFile, "utf-8"))).toString("base64")
      : null;

    const png = await render(
      blogOgElement({
        title: post.title,
        category: post.category,
        readingTime: post.readingTime,
        coverDataUri,
        iconDataUri: ICON_DATA_URI,
      })
    );
    fs.writeFileSync(path.join(ogDir, `${post.slug}.png`), png);

    meta.push({ slug: post.slug, title: post.title, description: post.description });
  }
  fs.writeFileSync(path.join(outDir, "blog-meta.json"), JSON.stringify(meta));

  const brandPng = await render(
    brandOgElement({
      headline: "Your neighbourhood marketplace.",
      subline: "Buy & sell locally. Post a flyer in 60 seconds — free.",
      iconDataUri: ICON_DATA_URI,
    })
  );
  fs.writeFileSync(path.join(outDir, "og-preview.png"), brandPng);

  return { postCount: posts.length };
}

const outDir = path.resolve(ROOT, process.argv[2] ?? "dist");
if (!fs.existsSync(outDir)) {
  console.error(`generate-og-assets: ${outDir} does not exist — run \`vite build\` first.`);
  process.exit(1);
}
const { postCount } = await generateOgAssets(outDir);
console.log(`generate-og-assets: wrote ${postCount} blog card(s), blog-meta.json, og-preview.png → ${path.relative(ROOT, outDir)}/`);
