# Cloudflare R2 CORS Configuration

## Problem
When uploading images directly to R2 using presigned URLs, browsers send CORS preflight requests (OPTIONS) that must be allowed by the R2 bucket's CORS policy. Without proper CORS configuration, uploads fail with a 403 error.

## Solution
Apply the following CORS policy to your R2 bucket `flyer-board-images`.

## CORS Policy

```json
[
  {
    "AllowedOrigins": [
      "https://flyerboard.com.au",
      "https://flyerboard.au",
      "http://localhost:5173"
    ],
    "AllowedMethods": [
      "GET",
      "PUT",
      "POST",
      "DELETE",
      "HEAD"
    ],
    "AllowedHeaders": [
      "*"
    ],
    "ExposeHeaders": [
      "ETag"
    ],
    "MaxAgeSeconds": 3600
  }
]
```

## How to Apply CORS Policy

### Option 1: Using Cloudflare Dashboard (Recommended)

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to **R2** in the left sidebar
3. Click on your bucket: **flyer-board-images**
4. Go to the **Settings** tab
5. Scroll down to **CORS Policy**
6. Click **Edit CORS Policy**
7. Paste the JSON configuration above
8. Click **Save**

### Option 2: Using Wrangler CLI

If you have Wrangler installed:

```bash
# Save the CORS policy to a file
cat > r2-cors-policy.json << 'EOF'
[
  {
    "AllowedOrigins": [
      "https://flyerboard.com.au",
      "https://flyerboard.au",
      "http://localhost:5173"
    ],
    "AllowedMethods": [
      "GET",
      "PUT",
      "POST",
      "DELETE",
      "HEAD"
    ],
    "AllowedHeaders": [
      "*"
    ],
    "ExposeHeaders": [
      "ETag"
    ],
    "MaxAgeSeconds": 3600
  }
]
EOF

# Apply the CORS policy
wrangler r2 bucket cors put flyer-board-images --file r2-cors-policy.json
```

## Verification

After applying the CORS policy:

1. Clear your browser cache
2. Try uploading an image in your application
3. Check the browser's Network tab - the OPTIONS preflight request should now return 200 OK
4. The subsequent PUT request should succeed

## Configuration Details

- **AllowedOrigins**: Your production domains and localhost for development
- **AllowedMethods**: All methods needed for image operations
- **AllowedHeaders**: `*` allows all headers (including `Content-Type: image/webp`)
- **ExposeHeaders**: `ETag` is exposed for cache validation
- **MaxAgeSeconds**: Browser caches the CORS policy for 1 hour

## Troubleshooting

If uploads still fail after applying CORS:

1. **Verify the policy is active**: Check in Cloudflare Dashboard under bucket settings
2. **Check browser console**: Look for specific CORS error messages
3. **Test with curl**: Verify presigned URLs work outside the browser
4. **Clear browser cache**: Hard refresh (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows)
5. **Check origin**: Ensure your dev server is running on `http://localhost:5173`

## Adding New Origins

To add new origins (e.g., preview deployments):

1. Update the `AllowedOrigins` array in the CORS policy
2. Reapply the policy using one of the methods above
3. Wait a few seconds for the changes to propagate
