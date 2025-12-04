# R2 Storage Migration

**Last Updated**: 2025-12-04

## Overview

FlyerBoard stores all uploaded images in **Cloudflare R2** instead of the
Convex storage primitive. New uploads go directly to R2 via the
`@convex-dev/r2` component and are referenced across the app using the
`r2:<key>` marker. Existing `_storage` documents remain readable (the backend
still resolves them), but you can migrate everything to R2 with the provided
internal action.

## Architecture

The upload flow uses **signed URLs** for security:

1. Frontend calls `uploadFile(file)` using the `@convex-dev/r2/react` hook
2. Hook requests a signed URL from Convex backend via `generateUploadUrl`
3. Convex backend (using R2 credentials) generates a temporary signed URL
4. Frontend uploads file directly to R2 using the signed URL
5. Frontend calls `syncMetadata` to record the upload in Convex
6. Convex `onUpload` callback tracks the upload in the database

**Important**: The frontend never has direct access to R2 credentials. All R2
operations are authenticated through Convex.

## Environment Variables

### Convex Deployment

The following environment variables must be set in your Convex deployment:

- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_ENDPOINT`
- `R2_BUCKET`

### Vercel Deployment

**No R2 environment variables are needed in Vercel.** The frontend only needs:

- `VITE_CONVEX_URL` - Your Convex deployment URL
- `VITE_DESCOPE_PROJECT_ID` - Your Descope project ID

## Running the migration

The migration lives in `convex/migrations.ts` as
`migrations:migrateLegacyImagesToR2`. It scans for ads and user profiles that
still reference Convex `_storage` IDs, copies their blobs into R2, updates the
document references to the new `r2:<key>` format, and (optionally) deletes the
legacy blobs.

Run the migration in batches to avoid timeouts:

```bash
# Dry-run copy for 20 records (ads + profiles) without deleting Convex blobs
npx convex run migrations:migrateLegacyImagesToR2 -- --batchSize 20

# After verifying the data, delete the migrated Convex blobs
npx convex run migrations:migrateLegacyImagesToR2 -- --batchSize 20 --deleteLegacy true
```

Arguments:

| Argument | Type | Default | Description |
|----------|------|---------|-------------|
| `batchSize` | number | `10` | Max ads and users processed in a single invocation |
| `deleteLegacy` | boolean | `false` | If `true`, removes the original Convex storage blobs after copying |

You can run the command repeatedly until it reports zero pending records. The
action is idempotent—already migrated images are skipped automatically.

## Compatibility

- `convex/posts.getImageUrl` serves both legacy `_storage` IDs and new `r2:<key>`
  references, so the UI continues to work while migration runs.
- Uploaders (`ImageUpload`, profile photo input) now rely on
  `@convex-dev/r2/react` and only emit `r2:<key>` references.
- The migration action intentionally leaves legacy blobs in Convex unless
  `--deleteLegacy true` is passed. This lets you verify data integrity before
  reclaiming storage.

## Local Testing

To test R2 uploads locally:

1. Ensure R2 environment variables are set in your Convex deployment
2. Run `npx convex dev` to start the Convex backend
3. Run `npm run dev` to start the frontend
4. Log in via Descope (authentication works in local development)
5. Upload images - authentication is enforced even locally

## Follow-up checklist

1. Verify that new uploads succeed locally and in Vercel previews.
2. Run the migration action until no pending ads or profiles remain.
3. (Optional) Remove the Convex HTTP proxy route at `convex/router.ts` if it
   becomes unused after the cutover.
