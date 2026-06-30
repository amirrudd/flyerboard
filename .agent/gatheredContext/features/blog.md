# Blog

**Last Updated**: 2026-06-30

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
- **SPA caveat**: this is a client-rendered SPA, so meta tags populate after JS
  runs. Googlebot and the major AI crawlers render JS, so it works, but if true
  pre-render/SSR is ever needed, that's the upgrade path. Documented, accepted.

## Authoring contract

`docs/guides/blog-content-guideline.md` is the human-facing source of truth:
length **800–1,500 words** (aim ~1,200; the user wants posts short), an "answer
block" right under the H1 for AI extraction, scannable `##` headings, ≥1 list, a
FAQ, and the **required frontmatter schema** (`title`, `description`, `slug`,
`date`, `updated?`, `author`, `category`, `keywords[]`, `readingTime?`). The
`slug` must equal the filename. The parser, loader, and that schema are a
contract — change one, change all three.

## Tests

`src/lib/frontmatter.test.ts` and `src/lib/blog.test.ts` (vitest) cover the
parser edge cases and that real posts load, sort newest-first, and have required
fields. The blog test relies on `import.meta.glob`, which vitest supports.
