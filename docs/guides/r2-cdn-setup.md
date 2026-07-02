# R2 Public CDN Setup (image delivery)

**Status**: Live since 2026-07-02. This documents the one-time setup so it can be reproduced
(e.g. for a staging bucket) and explains the moving parts. For the CORS/upload side, see
`r2-cors-setup.md`.

## What this achieves

Images are served from `https://img.flyerboard.com.au/<key>` — a stable URL per image —
cached at Cloudflare's edge (1 month) and in browsers (1 year). Before this, reads used
per-request presigned URLs, which cannot be cached (unique signature per URL) and bypass
the CDN (presigned URLs only work on the S3 API endpoint and are mutually exclusive with
custom domains).

## Setup steps

### 1. Attach a custom domain to the bucket
Cloudflare dashboard → **R2** → `flyer-board-images` → **Settings** → **Custom Domains** →
**Add** → `img.flyerboard.com.au`.

This creates the DNS record in the `flyerboard.com.au` zone and enables public read access
to the bucket through that hostname only. Requires the zone to be on the same Cloudflare
account. Wait for Status **Active** / Access **Enabled**.

### 2. Create the Cache Rule (required — the domain alone does NOT cache)
Cloudflare dashboard → select the **`flyerboard.com.au` zone** (Websites, not R2) →
**Caching** → **Cache Rules** → **Create rule**:

| Field | Value |
|---|---|
| Rule name | `cache-r2-images` |
| When: Hostname equals | `img.flyerboard.com.au` |
| Cache eligibility | Eligible for cache |
| Edge TTL | Ignore origin cache-control → **1 month** |
| Browser TTL | Override origin → **1 year** |

Both TTL overrides are load-bearing: the R2 objects have no `Cache-Control` metadata and
the UUID keys have no file extension, so Cloudflare's defaults would cache nothing
(`cf-cache-status: DYNAMIC`). The 1-year browser TTL is safe because image keys are
write-once UUIDs — a changed image is always a new URL.

### 3. Point the frontend at it
Vercel → Project → Settings → Environment Variables (Production):

```
VITE_R2_PUBLIC_URL=https://img.flyerboard.com.au
```

Then deploy. The frontend (`src/lib/imageUrl.ts`) derives public URLs from stored R2 keys
when this is set; unset, it falls back to the legacy presigned-URL query (`posts.getImageUrl`),
so the variable is safe to add/remove independently of code deploys.

## Verifying

Use **GET, not HEAD** — HEAD requests don't populate Cloudflare's cache and will show
`DYNAMIC` even when everything works:

```bash
URL="https://img.flyerboard.com.au/flyers/<postId>/<uuid>"
curl -s -o /dev/null -D - "$URL" | grep -iE "cf-cache-status|cache-control"
# 1st: cf-cache-status: MISS      2nd: cf-cache-status: HIT, cache-control: max-age=31536000
```

## Notes & trade-offs

- **Public bucket**: anyone with an image URL can fetch it without auth. Accepted — these
  images appear on public listing pages, and UUID keys are unguessable.
- **Deleted images**: the daily cleanup cron (`convex/imageCleanup.ts`) deletes objects
  after the retention window (default 30 days, `IMAGE_CLEANUP_RETENTION_DAYS`), but
  edge/browser caches may serve them until TTL lapses. Accepted.
- **Legacy `_storage` images**: old Convex-storage images have no R2 key and still go
  through the presigned fallback — do not remove `posts.getImageUrl`.
- **Do not add a second image hostname** (e.g. `img.flyerboard.au`) — it splits the cache
  for no benefit; `<img>` loads are not origin-restricted.
