# Storage & R2 Integration

**Last Updated**: 2026-07-02

## Overview
FlyerBoard uses Cloudflare R2 (S3-compatible) for image storage with direct uploads via presigned URLs.

## Architecture

### Why R2 Instead of Convex Storage?
1. **Size limits**: Convex has 5MB action limit, R2 has no practical limit
2. **Cost**: R2 is cheaper for large files
3. **Performance**: Direct uploads bypass Convex backend
4. **CDN**: R2 integrates with Cloudflare CDN for fast delivery

### Upload Flow
```
User selects image
    ↓
Compress client-side (WebP, 90% quality)
    ↓
Request presigned URL from Convex action
    ↓
Upload directly to R2 (PUT request)
    ↓
Store R2 reference in Convex database
```

## Implementation

### Presigned URL Generation
**File**: `convex/upload_urls.ts`

**Key Points**:
- Uses AWS SDK S3 client (R2 is S3-compatible)
- Generates temporary upload URLs (1 hour expiry)
- Includes authentication check
- Includes rate-limit check via `internal.lib.rateLimit.enforceRateLimit` (added 2026-05-09 — see `infrastructure/database.md` for the action-from-mutation pattern). Limit: 50/hour per user, key `generateUploadUrl`.
- Disables checksums to avoid CORS issues

```typescript
const command = new PutObjectCommand({
  Bucket: process.env.R2_BUCKET!,
  Key: key,
  ContentType: "image/webp",
  ChecksumAlgorithm: undefined, // CRITICAL: Prevents CORS errors
});

const url = await getSignedUrl(s3Client, command, {
  expiresIn: 3600,
  unhoistableHeaders: new Set(["x-amz-checksum-crc32"]), // CRITICAL
});
```

### Folder Structure
**Profile images**: `profiles/{userId}/{uuid}`
**Listing images**: `flyers/{postId}/{uuid}`

**Rationale**:
- Organized by entity type
- User/post ID for easy cleanup if needed
- UUID prevents filename conflicts

### R2 References
**Format**: `r2:path/to/file`

**Storage**:
```typescript
// In database
{
  image: "r2:profiles/user123/abc-def-123.webp"
}
```

**Retrieval**:
```typescript
// convex/posts.ts - getImageUrl query
if (isR2Reference(imageRef)) {
  const key = fromR2Reference(imageRef); // Remove "r2:" prefix
  return await r2.getUrl(key, { expiresIn: 60 * 60 * 24 }); // 24hr signed URL
}
```

### Direct Upload
**File**: `src/lib/uploadToR2.ts`

**Process**:
1. Compress image client-side
2. Get presigned URL from Convex
3. PUT directly to R2 using XMLHttpRequest
4. Track progress with callbacks
5. Return storage key

```typescript
xhr.open('PUT', uploadUrl);
xhr.setRequestHeader('Content-Type', 'image/webp');
xhr.send(compressedFile);
```

## CORS Configuration

### The Problem
Browsers send OPTIONS preflight requests for cross-origin PUT requests. R2 must allow these.

### The Solution
**File**: `docs/r2-cors-setup.md`

**CORS Policy** (applied in Cloudflare dashboard):
```json
[{
  "AllowedOrigins": [
    "https://flyerboard.com.au",
    "https://flyerboard.au", 
    "http://localhost:5173"
  ],
  "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
  "AllowedHeaders": ["*"],
  "ExposeHeaders": ["ETag"],
  "MaxAgeSeconds": 3600
}]
```

### Critical: Disable Checksums
**Why**: AWS SDK automatically adds `x-amz-checksum-crc32` header, causing CORS failures.

**Fix**: 
```typescript
ChecksumAlgorithm: undefined,
unhoistableHeaders: new Set(["x-amz-checksum-crc32"])
```

## Environment Variables

### Convex Deployment
```
R2_ACCESS_KEY_ID=xxx
R2_SECRET_ACCESS_KEY=xxx
R2_ENDPOINT=https://xxx.r2.cloudflarestorage.com/
R2_BUCKET=flyer-board-images
```

### Frontend (Vercel)
- `VITE_R2_PUBLIC_URL=https://img.flyerboard.com.au` — public R2 custom domain for CDN-cached image *reads* (since 2026-07-02). Unset → falls back to presigned URLs via `posts.getImageUrl`.
- Uploads still never touch R2 credentials from the frontend — writes go through Convex presigned URLs only.

## Image Retrieval

### For Display
**File**: `src/components/ui/ImageDisplay.tsx`

**Process**:
1. Component receives image reference (e.g., `r2:flyers/...`)
2. Queries `convex/posts.getImageUrl` with reference
3. Convex generates temporary signed URL (24hr expiry)
4. Component displays image from signed URL

### Legacy Support
**Also handles**:
- Old Convex storage IDs (UUIDs)
- External URLs (http://, https://)
- Data URLs (base64)

```typescript
// convex/posts.ts - getImageUrl
if (imageRef.startsWith('http')) return imageRef; // External
if (imageRef.startsWith('data:')) return imageRef; // Base64
if (isR2Reference(imageRef)) return await r2.getUrl(...); // R2
return await ctx.storage.getUrl(imageRef); // Legacy Convex
```

## Soft Delete Pattern

### Images NOT Deleted Immediately
When an ad is deleted:
- Ad marked as `isDeleted: true`
- Images remain in R2
- Queries filter out deleted ads

**Rationale**:
- Allows restoration if needed
- Prevents accidental data loss
- Cleanup can be batched

### Automated Cleanup — IMPLEMENTED 2026-07-02
**File**: `convex/imageCleanup.ts`. Daily cron (`convex/crons.ts`, `purge-deleted-ad-images`, 09:00 UTC) runs the `internalAction` `imageCleanup.purgeDeletedAdImages`.

**Schema additions** (`convex/schema.ts`, `ads` table):
- `deletedAt: v.optional(v.number())` — epoch ms stamped at every soft-delete site (`posts.deleteAd`, `admin.deleteUserAccount`, `admin.deleteFlyerAdmin`, `saleEvents.removeSaleItem`). Drives the retention clock.
- `imagesPurgedAt: v.optional(v.number())` — stamped once an ad's images have been purged. The ad row and `isDeleted: true` are NEVER removed — only `images: []` + this timestamp are set. Hard-deleting the ad row would violate the project's soft-delete rule.

**Policy**: retention days = `IMAGE_CLEANUP_RETENTION_DAYS` env var (default 30, clamped to a minimum of 1), or override per-invocation with `retentionDays` arg — e.g. `npx convex run imageCleanup:purgeDeletedAdImages '{"retentionDays": 7}'`.

**Selection**: uses the `by_deleted` index to narrow to `isDeleted: true` ads, then filters in memory for `deletedAt` set, past cutoff, `imagesPurgedAt` unset, and non-empty `images`. Capped at 50 ads/run.

**Backfill for pre-feature deletions**: ads that were `isDeleted: true` before this feature shipped have no `deletedAt`. A separate pass (capped 200/run) stamps `deletedAt: Date.now()` for those — their retention clock starts the day the backfill runs, and they are deliberately NOT purged in the same run.

**Per-image deletion, by ref shape** (mirrors the `getImageUrl` fallback chain above):
- `r2:<key>` → strip prefix, `r2.deleteObject(ctx, key)`.
- Raw legacy key (`flyers/`, `profiles/`, `ad/` prefix, no `r2:`) → `r2.deleteObject(ctx, key)` as-is.
- Legacy Convex `_storage` ID (no `/` in the ref) → `ctx.storage.delete(id)`, wrapped in try/catch to tolerate already-deleted objects.
- `http(s)://` or `data:` → skipped (external, nothing to delete).
- Every per-object delete is individually try/caught — one failure doesn't abort the ad's batch or the run; failures are counted and logged via `logOperation`.

**Convex action/mutation split**: `purgeDeletedAdImages` is the `internalAction` (R2 deletes are network calls, and actions can call `r2.deleteObject`/`ctx.storage.delete`); it drives everything through `internalQuery`/`internalMutation` helpers in the same file (`listAdsReadyForPurge`, `listAdsNeedingDeletedAtBackfill`, `getAdForPurge`, `stampDeletedAt`, `markImagesPurged`) called via `ctx.runQuery`/`ctx.runMutation` — same pattern as `migrations.migrateLegacyImagesToR2`.

**Gotcha**: no restore/undelete mutation exists yet in the codebase (grepped for `isDeleted: false` — only a seed script uses it). If one is added later, it must clear `deletedAt` (set `undefined`) — but ONLY when `imagesPurgedAt` is still unset. Restoring an ad after its images were purged is fine (the ad just has no images), but restoring should not resurrect a `deletedAt` timestamp that would immediately make it eligible for purge again.

## Performance Optimization

### Signed URL Caching — FIXED & LIVE 2026-07-02 (stable public URLs via CDN)
Background (still true today when `VITE_R2_PUBLIC_URL` is unset): `r2.getUrl()` mints a *new* SigV4 presigned URL on every call, and `ImageDisplay` re-ran `posts.getImageUrl` on every mount (Convex drops the query subscription on unmount) → browser HTTP cache never hit → full re-download from R2 on every Home ↔ AdDetail navigation. Presigned URLs also point at `*.r2.cloudflarestorage.com` directly, bypassing the Cloudflare CDN.

**Fix landed (client-side, env-gated)**: `src/lib/imageUrl.ts` exports `resolvePublicImageUrl(imageRef, publicBase = import.meta.env.VITE_R2_PUBLIC_URL)`. When `VITE_R2_PUBLIC_URL` is set (e.g. `https://img.flyerboard.com.au`, trailing slash normalized away), it derives a **stable, CDN-cacheable** URL directly from the key — no Convex round trip, no per-mount signature churn:
- `r2:<key>` → `${base}/<key>` (strip the `r2:` prefix via the existing `isR2Reference`/`fromR2Reference` helpers in `src/lib/r2.ts`).
- Legacy unprefixed keys starting with `flyers/`, `profiles/`, or `ad/` → `${base}/<key>`. **Keep these three prefixes in sync with the server-side check in `convex/posts.ts` `getImageUrl` (~lines 385-393)** — they're duplicated by necessity (client needs to decide without a round trip) and will silently drift if only one side is edited.
- `http(s)://` and `data:` refs always resolve locally (no round trip needed, no env dependency) — this is a strict improvement even before the domain is attached.
- Legacy Convex `_storage` IDs (no `/`, no known prefix) always return `null` — no stable public URL exists for these; they keep going through `getImageUrl`.
- Unset `VITE_R2_PUBLIC_URL` → returns `null` for R2 refs, and `ImageDisplay` falls back to the query exactly as before (this is how local dev without the env var behaves).

`ImageDisplay.tsx` usage: `const publicUrl = resolvePublicImageUrl(reference); const imageUrl = useQuery(api.posts.getImageUrl, reference && !publicUrl ? { imageRef: reference } : "skip"); const displaySrc = publicUrl || imageUrl || src;` — the query is skipped entirely once a public URL resolves.

**Infra — DONE 2026-07-02 (verified live)**:
- R2 custom domain `img.flyerboard.com.au` attached to the `flyer-board-images` bucket (R2 dashboard → bucket → Custom Domains; status Active/Enabled). Note: presigned URLs and custom domains are mutually exclusive access paths — presigned only works on `*.r2.cloudflarestorage.com`, the CDN only works on the custom domain.
- Cloudflare **Cache Rule** `cache-r2-images` on the `flyerboard.com.au` ZONE (not the R2 bucket page — Caching → Cache Rules): Hostname equals `img.flyerboard.com.au` → Eligible for cache, Edge TTL 1 month (ignore origin), Browser TTL 1 year (override origin). Both TTL overrides are REQUIRED: R2 objects carry no `Cache-Control` metadata and the UUID keys have no file extension, so without the rule Cloudflare returns `cf-cache-status: DYNAMIC` (no caching). 1-year browser TTL is safe because keys are write-once UUIDs.
- `VITE_R2_PUBLIC_URL=https://img.flyerboard.com.au` set in Vercel (production).
- Verified: `GET` #1 → `cf-cache-status: MISS`, #2 → `HIT` with `cache-control: max-age=31536000`. **Verification gotcha: use GET, not HEAD (`curl -I`) — HEAD requests do not populate Cloudflare's cache and report `DYNAMIC` even when the rule works.**

`getImageUrl` in `convex/posts.ts` remains as the fallback path for legacy `_storage` IDs only — do not remove it. Only one direct call site for `api.posts.getImageUrl` exists in the frontend (`ImageDisplay.tsx`); everything else routes through that component.

**Interaction with the cleanup cron**: after `purgeDeletedAdImages` deletes an object, edge/browser caches may serve it until their TTL lapses (up to 1 month edge / 1 year browser). Acceptable for deleted classifieds images; do not "fix" this by shortening TTLs.

### Direct Uploads
- Bypasses Convex backend
- No 5MB limit
- Faster for large files

### CDN Integration (live since 2026-07-02)
- Images served from `img.flyerboard.com.au` (Cloudflare edge cache in front of the R2 bucket)
- Requires the zone-level Cache Rule described above — attaching the custom domain alone does NOT enable caching
- Low latency worldwide

## Testing

### Local Development
1. Ensure R2 env vars set in Convex dashboard
2. Run `npx convex dev`
3. Upload images - should work same as production

### Verify CORS
```bash
# Test OPTIONS preflight
curl -X OPTIONS \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: PUT" \
  -H "Access-Control-Request-Headers: Content-Type" \
  https://your-bucket.r2.cloudflarestorage.com/test
```

Should return 200 with CORS headers.

### Common Issues

**403 Forbidden on upload**:
- Check CORS policy in R2 bucket settings
- Verify origin is in AllowedOrigins
- Ensure checksums disabled in presigned URL generation

**Image not displaying**:
- Check R2 reference format (`r2:path/to/file`)
- Verify signed URL generation in getImageUrl
- Check browser console for CORS errors

**Slow uploads**:
- Check network speed (adaptive compression should help)
- Verify direct upload (not going through Convex)
- Check R2 region (should be auto)

## Security

### Authentication
- Presigned URLs require authenticated Convex session
- URLs expire after 1 hour (upload) or 24 hours (download)
- No public bucket access

### Validation
- File size limit: 10MB (client-side)
- File type validation: Images only
- Malicious file detection: Browser handles

### Privacy
- Images stored with UUIDs (not predictable)
- Signed URLs prevent unauthorized access
- Deleted ads' images not publicly accessible

## Migration from Convex Storage

**Status**: Complete (see `docs/storage-migration.md`)

**Legacy support**: Old `_storage` IDs still work via fallback in `getImageUrl`.

**Cleanup**: Legacy images can be migrated using `migrations:migrateLegacyImagesToR2`.
