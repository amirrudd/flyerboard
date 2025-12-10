# FlyerBoard - Recent Updates

## Latest Changes (2025-12-10)

### Image Upload UX Improvements
- ✅ **Non-blocking compression**: Images appear instantly, compression runs in background
- ✅ **Adaptive compression**: Automatically adjusts based on network speed
- ✅ **Circular progress indicators**: Beautiful loading states for compression and upload
- ✅ **Consistent quality**: Always 90% quality regardless of connection speed

### Bug Fixes
- ✅ **Dashboard statistics**: Now correctly exclude deleted ads from counts
- ✅ **R2 upload CORS**: Fixed 403 preflight errors by disabling automatic checksums

### Technical Details

#### Adaptive Compression
The app detects network speed and optimizes compression:
- **Fast (>5 Mbps)**: 1.5MB max - less aggressive compression for faster processing
- **Medium (1-5 Mbps)**: 1MB max - standard compression
- **Slow (<1 Mbps)**: 0.8MB max - aggressive compression for smaller files

**Key principle**: Quality is always 90% to ensure ads look great for all viewers, regardless of who uploaded them.

#### New Files
- `src/lib/networkSpeed.ts` - Network speed detection and adaptive settings
- `src/components/ui/CircularProgress.tsx` - Reusable circular progress component
- `docs/r2-cors-setup.md` - R2 CORS configuration guide

#### Modified Files
- `src/components/ui/ImageUpload.tsx` - Non-blocking compression with immediate previews
- `src/features/ads/PostAd.tsx` - Compression state tracking and circular progress modals
- `src/lib/uploadToR2.ts` - Adaptive compression integration
- `convex/users.ts` - Filter deleted ads from statistics
- `convex/upload_urls.ts` - Disable checksums to fix CORS

## Testing

### Image Upload
1. Select multiple images → Should appear instantly
2. Check console for: `"Adaptive compression: [connection type]"`
3. Edit form while compression runs → Should be fully responsive
4. Click "Post Listing" quickly → Circular progress modal if still compressing

### Dashboard
1. Create and delete ads → Total count should update correctly
2. View counts should exclude deleted ads

## Documentation
- See [walkthrough.md](.gemini/antigravity/brain/23b4db0e-46a0-4293-9ffa-7c76b50eea13/walkthrough.md) for detailed implementation
- See [docs/storage-migration.md](docs/storage-migration.md) for R2 setup
- See [docs/r2-cors-setup.md](docs/r2-cors-setup.md) for CORS configuration
