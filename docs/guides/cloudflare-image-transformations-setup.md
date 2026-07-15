# Cloudflare Image Transformations Setup (OG share-card compression)

**Status**: Live on `flyerboard.com.au` since 2026-07-14. This documents the one-time
dashboard setup so it can be reproduced (e.g. for a staging zone) — there is no code-side
config for the toggle itself. For the OG card system this feeds, see
`.agent/gatheredContext/infrastructure/og-social-meta.md`.

## What this achieves

Every share-card image (`/api/og/ad/:id`, `/api/og/bundle/:id`, `/api/og/sale/:slug`, and
the build-time `dist/blog-og/*.png` / `dist/og-preview.png`) is generated as a **PNG** by
`@vercel/og` (its only output format) — typically ~700KB–1MB for a photo card. That's slow
to load on mobile and **exceeds WhatsApp's ~300KB link-preview size cap**, which silently
drops the preview image entirely.

`middleware.ts` wraps every `og:image` URL in a Cloudflare Image Transformations prefix
(`jpegImageUrl()`):

```
https://www.flyerboard.com.au/cdn-cgi/image/format=jpeg,quality=82/api/og/ad/<id>
```

Cloudflare fetches the original PNG from the wrapped path, re-encodes it as JPEG at
quality 82, and caches the result at the edge. Measured on a real card: **1,051,973 bytes
→ 92,283 bytes (11.4× smaller)**. This works identically for a dynamic edge-function path
or a static build-output asset (e.g. the blog's `/blog-og/<slug>.png`) — same prefix,
same mechanism, no code branching needed between the two.

## Setup steps

### 1. Enable Transformations for the zone
Cloudflare dashboard → select the **`flyerboard.com.au`** zone (top of the sidebar shows
the domain name — that *is* the zone selector, there's no separate "Domain" picker) →
**Images** → **Transformations** tab → **Enable** for this zone.

### 2. Set the source restriction
Once enabled, a **Sources** setting appears — set it to **Same zone only**. The transform
only ever needs to read images the app itself generates on `flyerboard.com.au`; "any
origin" would let third parties spend this zone's transformation quota by wrapping
arbitrary external images in the `/cdn-cgi/image/` prefix.

That's the entire setup — no rule to write, no redirect, no DNS change. The
`/cdn-cgi/image/...` prefix starts working the moment Transformations is enabled.

## Verifying

```bash
URL="https://www.flyerboard.com.au/cdn-cgi/image/format=jpeg,quality=82/api/og/ad/<real-ad-id>"
curl -sI "$URL" | grep -iE "content-type|content-length|cf-resized"
# expect: content-type: image/jpeg
#         content-length: well under 300000 (WhatsApp's cap)
#         cf-resized: internal=ok/... (Cloudflare's proof the transform actually ran,
#                     not just proxied the original through unchanged)
```

If Transformations is **not** enabled on the zone, the same URL 404s — that failure mode
looks identical to a routing/deploy problem, so check this dashboard toggle first before
assuming a code bug.

## Notes & trade-offs

- **Pricing**: 5,000 free unique transformations/month (billed per distinct
  source-image + options combination, not per view or per share — a listing shared
  10,000 times is still one billable transformation), then $0.50/1,000. The billable
  unit here is roughly "one per unique ad/bundle/sale/post ever shared," which will stay
  in the free tier for a long time at this app's scale. Shared with any other Cloudflare
  Media/Image Transformations usage on the same account.
- **`flyerboard.au` does not need this enabled** — it 301-redirects to
  `www.flyerboard.com.au` at the DNS/rules layer before any request reaches the app, so
  transformations only ever need to run on the canonical `.com.au` zone.
- **Do not remove the `sharp` version pin in `package.json`** (`^0.34.5`, matching
  `@vercel/og`'s own optional dependency) without checking this doc's counterpart in
  `infrastructure/og-social-meta.md` — an unpinned newer `sharp` loads a second native
  libvips binary into the same Node process as the build-time OG generator
  (`scripts/generate-og-assets.ts`), which macOS logs as a duplicate-class warning and
  Cloudflare's own docs flag as a real crash risk, not just noise.
