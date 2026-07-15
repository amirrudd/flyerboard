# Open Graph / Social Share Images

**Last Updated**: 2026-07-15 (all four link types live: flyer, bundle, moving sale, blog — plus the default brand card)

How shared FlyerBoard links (ad/bundle/sale/blog) render a preview in
iMessage/Slack/X/Facebook/LinkedIn/WhatsApp.

## The core problem (why this exists)

The app is a client-rendered SPA and `vercel.json` rewrites every path to
`index.html`. Per-page `<meta property="og:*">` tags set by React components
are injected **at runtime** — social crawlers don't run JS, so they only ever
saw `index.html`'s generic tags and a 404 `og-preview.png`. Fix = put real meta
in the HTML the crawler receives (Vercel Edge Middleware) and point `og:image`
at a generated PNG→JPEG card.

## Architecture — three independently-solved data sources, one visual system

Convex-backed types (ad/bundle/sale) render **at request time** via edge
functions; blog (static markdown) renders **at build time** since it's
unreachable from either the edge functions or middleware, both of which are
compiled independently from the Vite/SPA bundle.

- **`api/og/_template.ts`** — every card layout, `React.createElement` (not
  JSX — same module runs in edge functions, a build script, and local node
  harnesses with zero build step). Ink cards (`flyerOgElement`,
  `bundleOgElement`, `saleOgElement`) share `root`/`leftPanel`/`photoMosaic`;
  editorial cards (`blogOgElement`, `brandOgElement`) share a separate cream
  composition (`CREAM`/`creamLockup`) — deliberately a different visual
  language since blog/brand aren't marketplace listings.
  - `bundleOgElement`/`saleOgElement`'s price chip is NOT optional the way
    `flyerOgElement`'s is (every real bundle/sale has one) — for the
    not-found/unavailable case, **reuse `flyerOgElement`'s already chip-less
    look** rather than teaching the template a zero-price special case. Bit us
    once (a `$0` chip on the fallback card) before this pattern was set.
  - Long titles: satori's `lineClamp: N` truncates **with an ellipsis** — but
    ONLY on an element with `display:'block'`, not `flex` (verified against
    `@vercel/og@0.11.1`). One clean mechanism, replaced an earlier
    `maxHeight`+`overflow:hidden` pixel-guess.
- **`api/og/_render.ts`** — shared envelope for the three edge-function
  handlers: base64 font decode (module scope, once per warm isolate),
  `ImageResponse` construction, cache-control, and `withOgErrorHandling` (a
  thrown error becomes a readable 500 body instead of Vercel's opaque
  `FUNCTION_INVOCATION_FAILED` page).
- **`api/og/ad/[id].ts`**, **`api/og/bundle/[id].ts`**, **`api/og/sale/[slug].ts`**
  — edge functions. Each: fetch the public Convex query (no auth; missing/
  soft-deleted → null → shared "unavailable" fallback), build the element,
  `renderOgCard`. Public queries used: `adDetail.getAdById` (+
  `categories.getCategories`), `bundles.getPublicBundle`, `saleEvents.getSaleBySlug`.
- **`api/og/_imageUrl.ts`** — `publicImageUrl()`, server twin of
  `src/lib/imageUrl.ts` `resolvePublicImageUrl`. Keep prefixes in sync.
- **`scripts/generate-og-assets.ts`** — build-time generator for blog + the
  default brand card. Run via `tsx` as its own **explicit build step chained
  after `vite build`** (`package.json`: `"build": "vite build && tsx
  scripts/generate-og-assets.ts"`) — deliberately NOT a Vite plugin
  `writeBundle` hook: that hook runs inside Vite's own Node process, which has
  no general TS loader active beyond `vite.config.ts`'s own static import
  graph, so a dynamically-imported `.ts` file there is not reliably
  resolvable. An explicit `tsx` step is directly testable on its own
  (`npx tsx scripts/generate-og-assets.ts dist`) — always verify this way
  before trusting it, don't assume a build-tool hook "should" work.
  - Rasterizes each post's cover SVG via `sharp` (`scripts/blog-cover-og.mjs`
    `rasterizeCover`) → embeds as a data URI → renders `blogOgElement` →
    writes `dist/blog-og/<slug>.png`.
  - The cover SVGs (`public/blog-covers/*.svg`) bake in their own
    "FlyerBoard" wordmark + category label (consistent markup across all 7:
    a dot+text pair at `x="112" y="100"`, a label at `x="82" y="598"`, an
    underline `<line x1="82" y1="620"...>`) — our card supplies its own
    chrome, so `stripCoverChrome()` regexes those out before rasterizing or
    they leak into the crop as stray text fragments (caught this in review —
    a literal "rd" floating in the card).
  - Writes `dist/blog-meta.json` (slug/title/description per post) —
    middleware.ts self-fetches this at request time (same pattern as its
    existing `/index.html` fetch) since it can't read the filesystem.
  - Writes `dist/og-preview.png` (default brand card), fixing the site-wide
    404 fallback.
  - `sharp` is pinned to `^0.34.5` in `package.json` to match `@vercel/og`'s
    own optional dependency — an unpinned newer version installs a SECOND
    native libvips binary alongside it, which macOS logs as a duplicate
    Objective-C class warning ("may cause spurious casting failures and
    mysterious crashes"). Keep them in sync if either bumps.
- **`middleware.ts`** — Edge Middleware, `matcher: ["/ad/:id", "/bundle/:id",
  "/sale/:slug", "/blog/:slug"]`. Fetches `/index.html` **concurrently** with
  the Convex/JSON meta lookup, replaces `<title>`, strips every existing
  `og:*`/`twitter:*` tag (not just `og:image` — `index.html` now sets a full
  default set for the homepage/fallback, so a narrower strip left duplicates),
  injects the resolved tags before `</head>`. `jpegImageUrl()` wraps every
  card URL in the Cloudflare Transformations prefix (see below). User-supplied
  title/description are HTML-escaped.
  - The `matcher` array and the route regexes inside `resolveMeta` must stay
    in sync — adding a link type means editing both, 20 lines apart with no
    compiler link between them.

## Load-bearing gotchas

- **Cloudflare JPEG transform, not raw PNG**: `@vercel/og` only outputs PNG
  (~700KB–1MB per card) — fine for FB/X/LinkedIn/iMessage/Slack but over
  WhatsApp's ~300KB preview cap, and slow-loading on mobile. Every `og:image`
  is wrapped as `${origin}/cdn-cgi/image/format=jpeg,quality=82${path}`
  (`jpegImageUrl()` in middleware.ts) — Cloudflare re-encodes at the edge,
  cached. **Requires zone-level Image Transformations enabled** (Cloudflare
  dashboard → the zone → Images → Transformations → enable, Sources: same
  zone) — confirmed live + verified on `flyerboard.com.au` (11.4× size
  reduction measured: 1,051,973 → 92,283 bytes). Free tier: 5,000 unique
  transformations/month (billed per distinct source+options combo, not per
  view/share — a viral share of one card is still 1), $0.50/1,000 after.
  Works on ANY origin path (static asset or edge function), so blog's static
  PNGs use the identical transform as the dynamic ad/bundle/sale ones.
- **satori (@vercel/og) quirks**: every element with >1 child MUST set
  `display:'flex'`. `lineClamp` needs `display:'block'` (see above). `img`
  `objectFit:'cover'` works and does the crop. Fonts must be **TTF/OTF, not
  woff2**. **Do NOT `fetch()` fonts at module scope** — the deployed edge
  bundle does not include arbitrary asset files, so
  `fetch(new URL('../fonts/x.ttf', import.meta.url))` rejects at module init
  and crashes EVERY invocation with `FUNCTION_INVOCATION_FAILED`, opaquely
  (this shipped broken once — see #311). Fonts are base64-embedded in
  `api/og/_fonts.ts` and decoded once at module scope instead; raw TTFs stay
  in `api/og/fonts/` only for tooling/local harnesses/the build script.
- **`vercel.json` catch-all MUST exclude `/api`** (shipped broken once — see
  #310): Vercel applies `rewrites` **before** matching serverless/edge
  functions, so an unqualified `/(.*) → /index.html` rewrites
  `/api/og/ad/:id` to the SPA shell and the function never runs — crawlers get
  HTML as the image. Source must be `/((?!api/).*)` (negative lookahead).
  Static assets are unaffected (filesystem phase precedes rewrites) — this is
  ALSO why middleware.ts worked immediately but the image endpoint didn't:
  middleware runs before rewrites, `/api` functions after.
- **Static build-output files ARE reachable without any `vercel.json` entry**
  — `dist/blog-meta.json`, `dist/blog-og/*.png`, `dist/og-preview.png` need no
  routing config: Vercel serves any file that physically exists in the static
  output before falling through to rewrites (same reasoning as the `/api`
  fix above, and already proven by the pre-existing `sitemap.xml`/`llms.txt`
  generator in `vite.config.ts` working with zero vercel.json changes).
- **Directory-index clean-URL serving is NOT relied on** — deliberately
  avoided prerendering full `dist/blog/<slug>/index.html` files and trusting
  Vercel to serve them at `/blog/<slug>` (no trailing slash): Vercel's docs
  don't clearly confirm that specific behavior, and this session already got
  burned once by an unverified Vercel routing assumption (the `/api` bug
  above). Chose the mechanism ALREADY proven working instead: middleware
  self-fetching a static JSON file, the same pattern it already uses for
  `/index.html`.
- **`VITE_` env vars at runtime**: functions/middleware read
  `process.env.VITE_CONVEX_URL` / `VITE_R2_PUBLIC_URL`. Vercel exposes ALL
  project env vars to the function runtime regardless of the `VITE_` prefix.
- **ESLint typed-lint**: `eslint.config.js` uses `projectService: true`, so
  any `.ts`/`.tsx` outside a tsconfig `include` fails to parse (silently
  SKIPPED, not failed, for extensions outside the `**/*.{ts,tsx}` glob like
  `.mts`/`.mjs` — meaning those files get ZERO lint coverage unless renamed).
  `api/**` + `middleware.ts` → `tsconfig.vercel.json`. `scripts/**/*.ts` (and
  `vite.config.ts`) → `tsconfig.node.json` (needs
  `allowImportingTsExtensions: true` since these scripts import sibling `.ts`
  files with explicit extensions). Add new server/script files to the right
  one or CI's `eslint .`/`tsc -b` silently miss them.
- **`.js` import specifiers** in api/middleware/scripts resolve to `.ts`
  sources under `moduleResolution: bundler`.

## Verified

Every card type rendered + visually inspected via local harnesses using the
REAL template/handler code (not reimplemented test doubles) against real
Convex dev data and real blog markdown: flyer (landscape/portrait/exchange/
no-photo), bundle (2/3/4-item mosaics, real bundle data, not-found fallback),
sale (mosaic + "+N" remainder badge), blog (7 real posts, long-title clamp,
no-cover fallback), brand card. `publicImageUrl`/`formatPrice` unit tests,
`tsc -b`, `eslint .`, full `vitest run` (738 tests) all pass. Cloudflare JPEG
transform + the `/api` rewrite fix + the font-embedding fix all verified live
on production with real `curl` measurements (see PRs #310, #311, #313).

**Still needs an on-device check post-deploy**: a real WhatsApp/iMessage share
of a bundle/sale/blog link (ad was already confirmed working end-to-end on a
real device in an earlier round).

## Brand assets for cards

Mark = the app icon `public/icons/icon-128x128.png` (data URI in
`api/og/_icon.ts`); wordmark = "FlyerBoard" in **Fraunces**. Ink cards: body/
price in **Plus Jakarta Sans**, `#DC3626` price chip is the only accent
surface. Editorial cards (blog/brand): cream `#F7F6F3` ground, same two
typefaces, `#DC3626` category eyebrow instead of a chip. See also
[[storage]] for image URL resolution.
