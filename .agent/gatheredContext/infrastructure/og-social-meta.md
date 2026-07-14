# Open Graph / Social Share Images

**Last Updated**: 2026-07-14 (flyer OG image + meta middleware landed; blog + default card pending)

How shared FlyerBoard links render a preview in iMessage/Slack/X/Facebook/LinkedIn/WhatsApp.

## The core problem (why this exists)

The app is a client-rendered SPA and `vercel.json` rewrites every path to
`index.html`. The per-page `<meta property="og:*">` tags in `BlogPostPage.tsx`
and `AdDetail` are injected by React **at runtime** — social crawlers don't run
JS, so they only ever saw `index.html`'s generic tags **and a 404
`/og-preview.png`** (that file never existed). Every shared link previewed as
bare "FlyerBoard" + broken image.

Fix = put real meta in the HTML the crawler receives (Vercel Edge Middleware)
and point `og:image` at a per-listing PNG generator (`@vercel/og`).

## Architecture (all Vercel, data from Convex)

- **`api/og/ad/[id].ts`** — edge function, `@vercel/og` `ImageResponse`.
  `GET /api/og/ad/:id` → 1200×630 PNG. Fetches the ad via the **public**
  `adDetail.getAdById` query (no auth; soft-deleted → null → "unavailable"
  fallback card) + `categories.getCategories` for the category label.
- **`api/og/_template.ts`** — the card layout (`flyerOgElement`). Written with
  `React.createElement` (aliased `h`), **not JSX**, so the exact same module
  renders in the edge function AND in a local node harness with no JSX build.
- **`api/og/_imageUrl.ts`** — `publicImageUrl()`, the server twin of
  `src/lib/imageUrl.ts` `resolvePublicImageUrl` (r2:/legacy-key/http → CDN URL;
  legacy `_storage` IDs → null). Keep prefixes in sync with both siblings.
- **`middleware.ts`** — Edge Middleware, `matcher: ["/ad/:id"]`. Fetches
  `/index.html`, replaces `<title>`, strips the default `og:image`, injects
  resolved OG/Twitter tags before `</head>`. Returns the same SPA shell, so
  humans are unaffected. User-supplied title/description are HTML-escaped.

## Load-bearing gotchas

- **satori (@vercel/og) quirks**: every element with >1 child MUST set
  `display:'flex'`; titles use satori `lineClamp: 3` (N-line truncation **with**
  an ellipsis) — but it only applies on an element set to `display:'block'`, NOT
  flex (verified against `@vercel/og@0.11.1`; a `maxHeight`+`overflow:hidden`
  guard was the earlier workaround before we confirmed lineClamp works);
  `objectFit:'cover'` on `<img>` works and does the photo crop. Fonts must be
  **TTF/OTF, not woff2** (satori/opentype.js can't read woff2) — committed under
  `api/og/fonts/`, loaded once at module scope via `fetch(new URL('../fonts/x.ttf',
  import.meta.url))` (hoisted so a warm isolate fetches them once, not per request).
- **`VITE_` env vars at runtime**: functions/middleware read
  `process.env.VITE_CONVEX_URL` / `VITE_R2_PUBLIC_URL`. Vercel exposes ALL
  project env vars to the function runtime regardless of the `VITE_` prefix (the
  prefix only governs Vite's *client* bundling), so no new env vars are needed.
- **PNG size vs WhatsApp**: `@vercel/og` only outputs PNG. Photo cards weigh
  ~700–750KB — fine for FB/X/LinkedIn/iMessage/Slack (multi-MB limits) but over
  WhatsApp's ~300KB preview threshold. If WhatsApp previews matter, re-encode to
  JPEG via Cloudflare Image Resizing in front of the endpoint (the image CDN is
  already Cloudflare). Not done yet.
- **ESLint typed-lint**: `eslint.config.js` uses `projectService: true`, so any
  `.ts` outside a tsconfig `include` fails to parse. `api/**` + `middleware.ts`
  are covered by **`tsconfig.vercel.json`** (referenced from root `tsconfig.json`).
  Add new server files there or CI's `eslint .` breaks.
- **`.js` import specifiers** in api/middleware resolve to `.ts` sources under
  `moduleResolution: bundler` (Vercel esbuild + local tsc both accept this).
- **vercel.json catch-all is safe**: Vercel checks functions/static before
  `rewrites`, so `/api/og/*` isn't shadowed by the `/(.*) → /index.html` rewrite.

## Verified vs pending

- **Verified locally**: card renders (landscape/portrait/exchange/unavailable via
  a node harness using the real `_template.ts`), `publicImageUrl` + `formatPrice`
  unit tests (`api/og/_imageUrl.test.ts`), typecheck, eslint, `tsc -b`.
- **Needs a Vercel PREVIEW deploy to confirm** (can't run edge middleware
  locally): middleware route interception + `/index.html` fetch/rewrite. Verify
  with the Facebook Sharing Debugger + a real WhatsApp/iMessage share.
- **Not built yet**: `/blog/:slug` card (`api/og/blog/[slug].ts`) + a build-time
  `_blogMeta` map (markdown frontmatter isn't reachable from edge) + adding
  `/blog/:slug` to the middleware matcher; and the default `public/og-preview.png`
  brand card for the homepage/fallback (fixes the site-wide 404).

## Brand assets for cards

Mark = the app icon `public/icons/icon-128x128.png` (embedded as a data URI in
`api/og/_icon.ts`); wordmark = "FlyerBoard" in **Fraunces** (matches
`font-display` in `Header.tsx`). Body/meta/price in **Plus Jakarta Sans**.
Price chip is the only `#DC3626` surface. See also [[storage]] for image URLs.
