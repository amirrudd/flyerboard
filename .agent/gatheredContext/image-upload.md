# Image Upload & Compression

**Last Updated**: 2025-12-20

## Overview
FlyerBoard uses adaptive, non-blocking image compression to optimize upload times while maintaining consistent quality for all viewers.

## Key Principles

### 1. Quality Consistency
**Rule**: Image quality is ALWAYS 90% WebP, regardless of uploader's connection speed.

**Rationale**: 
- Ads must look good for all viewers, not just those with fast connections
- Someone on slow 2G shouldn't upload low-quality images that look bad to everyone
- 90% WebP ≈ 95-98% JPEG quality - excellent for product photos

### 2. Adaptive File Size
**Rule**: Only the compression aggressiveness (maxSizeMB) varies based on network speed.

**Settings**:
- Fast (>5 Mbps): 1.5MB max - less aggressive compression
- Medium (1-5 Mbps): 1MB max - standard compression  
- Slow (<1 Mbps): 0.8MB max - aggressive compression

**Rationale**:
- Fast connections: Larger files upload quickly, so save compression time
- Slow connections: Smaller files worth the extra compression time
- Goal: Minimize total time (compression + upload)

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
  maxSizeMB: settings.maxSizeMB,  // Adaptive: 0.8-1.5MB
  useWebWorker: true,              // Non-blocking
  fileType: 'image/webp',          // Optimal format
  initialQuality: settings.quality, // Always 0.9 (90%)
});
```

## Performance Characteristics

### Compression Time
- **Small images (< 1MB)**: ~500ms - 1s
- **Medium images (1-5MB)**: ~1-3s
- **Large images (5-10MB)**: ~2-5s

**Note**: Times vary by device CPU and image complexity.

### Upload Time (after compression)
- **Fast WiFi (10 Mbps)**: 0.5-1.5MB → ~1-2s
- **4G (5 Mbps)**: 0.5-1.5MB → ~1-3s
- **3G (1 Mbps)**: 0.5-1MB → ~4-8s
- **2G (0.25 Mbps)**: 0.5-0.8MB → ~16-25s

### Total Time Optimization
Example: 5MB original image

| Connection | Settings | Compress | Upload | Total |
|------------|----------|----------|--------|-------|
| Fast WiFi (10 Mbps) | 1.2MB @ 90% | 2s | 1s | **3s** ✅ |
| 3G (1 Mbps) | 0.7MB @ 90% | 3s | 5.6s | **8.6s** ✅ |

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

- [ ] Manual quality toggle in user settings
- [ ] Progressive compression (show low-quality preview first)
- [ ] Batch optimization for multiple images
- [ ] Responsive image generation (multiple sizes)
- [ ] Client-side image editing (crop, rotate)
