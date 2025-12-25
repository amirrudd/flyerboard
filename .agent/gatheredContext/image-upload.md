# Image Upload & Compression

**Last Updated**: 2025-12-25

## Overview
FlyerBoard uses adaptive, non-blocking image compression to optimize upload times while preserving image resolution and quality for all viewers.

## Key Principles

### 1. Resolution Preservation
**Rule**: Image resolution is PRESERVED up to 2048px on the longest side, regardless of network speed.

**Rationale**: 
- Ads must look sharp and clear for all viewers
- Downscaling resolution causes blurry images that look bad to everyone
- 2048px is sufficient for high-quality display on all devices
- Modern connections can handle 2-4MB files without issue

### 2. Adaptive Quality
**Rule**: Quality varies (85-92%) based on network speed to optimize upload time while maintaining visual quality.

**Settings**:
- Fast (>5 Mbps): 92% quality, 10MB max (safety net)
- Medium (1-5 Mbps): 88% quality, 10MB max (safety net)
- Slow (<1 Mbps): 85% quality, 10MB max (safety net)

**Rationale**:
- Fast connections: Higher quality, files upload quickly
- Slow connections: Slightly lower quality to reduce upload time
- All settings preserve resolution - quality adjustment is subtle
- 10MB limit acts as safety net, won't constrain normal images (typically 1.5-4MB)
- Goal: Sharp images with reasonable upload times

### 3. Non-Blocking UX
**Rule**: Images appear instantly, compression happens in background.

**Flow**:
1. User selects images → Previews show immediately (from original file)
2. Compression starts in background (Web Worker - non-blocking)
3. User can edit form while compression runs
4. User clicks "Post Listing":
   - If compression done → Upload immediately
   - If still compressing → Show circular progress modal → Wait → Upload

## Implementation

### Network Speed Detection
**File**: `src/lib/networkSpeed.ts`

**Methods**:
1. Network Information API (primary)
2. Small test download (fallback)
3. Conservative defaults (if both fail)

**Caching**: Speed detected once per session on component mount.

### Image Upload Component
**File**: `src/components/ui/ImageUpload.tsx`

**State Management**:
```typescript
interface ImageState {
  id: string;
  preview: string;        // Original file preview (data URL)
  file: File;            // Original file
  compressed: File | null; // Compressed file when ready
  status: 'compressing' | 'ready' | 'error';
  error?: string;
}
```

**Key Features**:
- Immediate preview display using `FileReader.readAsDataURL()`
- Background compression with `imageCompression()` + Web Worker
- Status tracking per image
- Callback to parent with compression states

### Upload Flow
**File**: `src/features/ads/PostAd.tsx`

**Process**:
1. Track `imageStates` from `ImageUpload`
2. On submit, check if all images compressed
3. If not, show circular progress modal and poll status
4. Once ready, extract compressed files and upload to R2
5. Show upload progress with circular indicator

### Compression Settings
**Files**: `src/lib/uploadToR2.ts`, `src/components/ui/ImageUpload.tsx`

```typescript
const settings = await getOptimalCompressionSettings();
const compressedFile = await imageCompression(file, {
  maxSizeMB: settings.maxSizeMB,    // 10MB safety net (won't constrain normal images)
  maxWidthOrHeight: 2048,           // Preserve resolution
  useWebWorker: true,               // Non-blocking
  fileType: 'image/webp',           // Optimal format
  initialQuality: settings.quality, // Adaptive: 0.85-0.92
});
```

## Performance Characteristics

### Compression Time
- **Small images (< 1MB)**: ~500ms - 1s
- **Medium images (1-5MB)**: ~1-3s
- **Large images (5-10MB)**: ~2-5s

**Note**: Times vary by device CPU and image complexity. Resolution is preserved (max 2048px).

### Upload Time (after compression)
- **Fast WiFi (10 Mbps)**: 2-4MB → ~2-4s
- **4G (5 Mbps)**: 2-4MB → ~3-6s
- **3G (1 Mbps)**: 1-2MB → ~8-16s
- **2G (0.25 Mbps)**: 1-2MB → ~32-64s

### Total Time Optimization
Example: 7.8MB iPhone photo (3024x4032 pixels)

| Connection | Settings | Result Size | Compress | Upload | Total |
|------------|----------|-------------|----------|--------|-------|
| Fast WiFi (10 Mbps) | 2048px @ 92% | ~3.5MB | 3s | 3s | **6s** ✅ |
| 3G (1 Mbps) | 2048px @ 85% | ~2MB | 4s | 16s | **20s** ✅ |

**Key Improvement**: Images maintain full resolution (2048px) instead of being downscaled to 430px, resulting in sharp, clear photos.

## Common Patterns

### Adding Image Upload to a Form
```typescript
const [images, setImages] = useState<string[]>([]);
const [imageStates, setImageStates] = useState<Map<string, ImageState>>(new Map());

<ImageUpload
  images={images}
  onImagesChange={setImages}
  onCompressionStateChange={setImageStates}
  maxImages={5}
/>
```

### Checking Compression Status Before Submit
```typescript
const handleSubmit = async () => {
  const states = Array.from(imageStates.values());
  const stillCompressing = states.filter(s => s.status === 'compressing');
  
  if (stillCompressing.length > 0) {
    // Show progress modal and wait
    setIsWaitingForCompression(true);
    // Poll until all ready...
  } else {
    // All ready, proceed immediately
    await performUpload();
  }
};
```

### Extracting Compressed Files
```typescript
const compressedFiles: File[] = [];
const states = Array.from(imageStates.values());

for (const state of states) {
  if (state.status === 'ready' && state.compressed) {
    compressedFiles.push(state.compressed);
  } else if (state.status === 'error') {
    toast.error('Some images failed to compress');
    return;
  }
}
```

## Testing

### Manual Testing
1. **Fast connection**: Select large images → Should compress quickly, larger files
2. **Slow connection**: Throttle network in DevTools → Should compress more aggressively
3. **Console log**: Check for "Adaptive compression: [type]" message
4. **Quick submit**: Click "Post" immediately after selecting → Progress modal should appear
5. **Form interaction**: Verify form remains responsive during compression

### Edge Cases
- ✅ User removes image while compressing → State cleaned up
- ✅ User navigates away → Compression continues (Web Worker)
- ✅ Compression fails → Error state, user can remove and retry
- ✅ Network detection fails → Falls back to balanced settings (1MB @ 90%)

## Known Issues & Limitations

1. **Network detection accuracy**: May not be perfect on all browsers
   - Fallback to conservative defaults if unavailable
   
2. **HEIC/HEIF support**: Relies on browser support
   - `browser-image-compression` handles conversion
   - May fail on older browsers

3. **Memory usage**: Large images (>10MB) may cause issues
   - Validation rejects files >10MB before processing

4. **Compression quality**: Fixed at 90% (no user control)
   - Future: Could add manual override in settings

## Future Enhancements

### Progressive Image Loading

**Status**: ✅ **Phase 1 Complete** - WebP format provides progressive-like loading

**Current Implementation:**
- All images are compressed to WebP format
- WebP inherently supports progressive decoding in modern browsers
- Images load incrementally as data arrives (similar to progressive JPEG)
- No additional configuration needed

**How it works:**
- WebP uses VP8/VP9 encoding which supports incremental decoding
- Browsers render partial image data as it arrives
- Users see a gradually improving image rather than waiting for full load
- Especially effective on slower connections

**Phase 2 (Future - LQIP Blur-up):**
- [ ] Generate tiny blur placeholders (~20x20px @ 50% quality)
- [ ] Store blur as base64 in database
- [ ] Show instant blur while full image loads
- [ ] Smooth transition when full image ready
- **Estimated effort**: 4-6 hours
- **Impact**: Dramatic perceived performance boost (like Medium, Pinterest)

**Other Enhancements:**
- [ ] Manual quality toggle in user settings
- [ ] Batch optimization for multiple images
- [ ] Responsive image generation (multiple sizes)
- [ ] Client-side image editing (crop, rotate)
