# Storage & R2 Integration

**Last Updated**: 2025-12-20

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
**None needed** - Frontend never accesses R2 directly, only through Convex presigned URLs.

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

### Future: Automated Cleanup
**TODO**: Implement scheduled job to delete images from R2 after 30+ days.

```typescript
// Pseudocode for future implementation
export const cleanupDeletedImages = internalMutation({
  handler: async (ctx) => {
    const deletedAds = await ctx.db
      .query("ads")
      .filter(q => 
        q.and(
          q.eq(q.field("isDeleted"), true),
          q.lt(q.field("_creationTime"), Date.now() - 30 * 24 * 60 * 60 * 1000)
        )
      )
      .collect();
    
    for (const ad of deletedAds) {
      // Delete images from R2
      // Hard delete ad from database
    }
  }
});
```

## Performance Optimization

### Signed URL Caching
- URLs valid for 24 hours
- Browser caches images
- Reduces Convex query load

### Direct Uploads
- Bypasses Convex backend
- No 5MB limit
- Faster for large files

### CDN Integration
- R2 integrates with Cloudflare CDN
- Images served from edge locations
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
