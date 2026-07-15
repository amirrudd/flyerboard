# Blog

**Last Updated**: 2026-07-15 (corrected two stale OG/SSR notes below — see `infrastructure/og-social-meta.md`)

The blog is a file-based, SEO + GEO (Generative Engine Optimization) oriented
content section. Goal: rank in classic search **and** be easy for AI assistants
to extract and cite. No backend, no Convex table.

## How it works (the pattern)

- **Content = markdown files** in `src/content/blog/<slug>.md`, each with YAML
  frontmatter. Dropping a new `.md` file in that folder publishes a post — no
  routing or registration step. This reuses the existing `src/content/*.md` +
  `?raw` pattern already used by About/Terms/Privacy.
- **Loader**: `src/lib/blog.ts` uses `import.meta.glob("../content/blog/*.md",
  { eager: true, query: "?raw", import: "default" })` to bundle every post at
  build time, parses frontmatter, sorts **newest-first** (consistent with the
  feed rule), and exposes `getAllPosts()` / `getPostBySlug()`.
- **Frontmatter parser**: `src/lib/frontmatter.ts` — a tiny, dependency-free
  parser (no gray-matter; that drags Buffer/Node into the browser bundle). It is
  **pure** (no Node/DOM APIs) on purpose, so it's imported by BOTH the browser
  loader and the build-time generator in `vite.config.ts`. Handles flat
  `key: value`, inline `key: [a, b]` arrays, quotes, CRLF, and a leading BOM.
  ⚠️ Don't write a literal U+FEFF in source — eslint's `no-irregular-whitespace`
  rejects it; use the `﻿` escape (this bit us once).
- **Pages**: `src/pages/BlogIndexPage.tsx` (card grid, newest-first) and
  `src/pages/BlogPostPage.tsx` (renders `post.content` via the shared
  `MarkdownContent` component). Both lazy-loaded in `App.tsx` at `/blog` and
  `/blog/:slug`, inside the `<Layout>` shell. Nav link added in
  `src/features/layout/Sidebar/SidebarContent.tsx` footer list.

## SEO / GEO mechanics (the load-bearing part)

- **React 19 native document metadata**: the pages render `<title>`, `<meta>`,
  `<link rel="canonical">`, and a `<script type="application/ld+json">` *directly
  in JSX* — React 19 hoists them into `<head>`. No react-helmet needed. JSON-LD
  uses `dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}` (the repo's
  eslint config has **no** `react/no-danger` rule, so don't add an
  `eslint-disable react/no-danger` comment — it errors as "rule not found").
- **Schema**: post pages emit `BlogPosting` JSON-LD; the index emits `Blog` +
  nested `blogPost`. Canonical/OG URLs use `SITE_URL =
  "https://flyerboard.com.au"` (hardcoded constant in both pages and
  `vite.config.ts` — keep them in sync if the domain changes).
- **Build-time discoverability files**: `blogDiscoverabilityPlugin()` in
  `vite.config.ts` (a `writeBundle`-hook plugin, `apply: "build"`) reads the same
  markdown files and emits `dist/llms.txt` (AI-crawler index) and
  `dist/sitemap.xml`. It writes via `fs.writeFileSync(options.dir, ...)` rather
  than `this.emitFile` to avoid Rollup `this`-typing friction. Dev server doesn't
  serve these (prod crawlers only) — that's intentional.
- **Build-time OG card generation**: a SEPARATE step, `scripts/generate-og-assets.ts`
  (run via `tsx`, chained after `vite build` in `package.json`'s `build` script —
  deliberately not folded into `blogDiscoverabilityPlugin`'s `writeBundle` hook,
  since that hook can't reliably import `.ts` files at runtime). For every post it
  rasterizes the SVG `heroImage` (stripping the cover's own baked-in wordmark/label
  first — see `scripts/blog-cover-og.mjs`), renders a branded 1200×630 card, and
  writes `dist/blog-og/<slug>.png` + `dist/blog-meta.json`. Full mechanics, the
  Cloudflare JPEG-transform step, and the middleware wiring live in
  `infrastructure/og-social-meta.md` — this file only covers the blog-specific
  slice (the cover-SVG rasterization + which build step runs when).
- **SPA caveat — partially resolved, don't re-introduce the old assumption**:
  the post *body* still only renders after client JS runs (Googlebot and major AI
  crawlers execute JS, so that's fine). But the **crawler-critical share preview**
  (title, description, `og:image`) no longer depends on JS at all: `middleware.ts`
  intercepts `/blog/:slug` and injects real meta tags into the HTML response
  itself, using `blog-meta.json` + the pre-rendered card above. This was the
  "if true pre-render is ever needed, that's the upgrade path" line this file
  used to carry — it's now built for the meta tags specifically (not the full
  page body). See `infrastructure/og-social-meta.md` for why full HTML
  prerendering at the clean `/blog/:slug` URL was deliberately avoided in favor
  of this middleware approach.

## Authoring contract

`docs/guides/blog-content-guideline.md` is the human-facing source of truth:
length **800–1,500 words** (aim ~1,200; the user wants posts short), an "answer
block" right under the H1 for AI extraction, scannable `##` headings, ≥1 list, a
FAQ, and the **required frontmatter schema** (`title`, `description`, `slug`,
`date`, `updated?`, `author`, `category`, `keywords[]`, `readingTime?`,
`heroImage?`, `heroAlt?`). The `slug` must equal the filename.

**Hero covers**: `heroImage` (optional) is a `/public` path or URL shown at the
top of the post and as the index card thumbnail (both `aspect-[16/9]`), and is
added to the post's `BlogPosting` JSON-LD `image`. House covers are minimalist
editorial **SVGs** in `public/blog-covers/<slug>.svg` (warm-bone canvas, one
muted-pastel offset shape, bold charcoal line-art — built per the `minimalist-ui`
skill).

`og:image` is now a real per-post card, not the generic site default — SVG
previews poorly on social, so `scripts/generate-og-assets.ts` rasterizes the
SVG `heroImage` at build time and composes it into a branded 1200×630 JPEG
(see `infrastructure/og-social-meta.md`). Only `/blog-covers/*.svg` local
covers get rasterized this way; a post with an external or non-SVG `heroImage`
falls back to the plain brand-mark card, so prefer a local SVG cover for a
proper social preview. The parser, loader, and that schema are a
contract — change one, change all three.

## Tests

`src/lib/frontmatter.test.ts` and `src/lib/blog.test.ts` (vitest) cover the
parser edge cases and that real posts load, sort newest-first, and have required
fields. The blog test relies on `import.meta.glob`, which vitest supports.
