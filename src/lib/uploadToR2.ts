import imageCompression from 'browser-image-compression';
import { getOptimalCompressionSettings } from './networkSpeed';

/**
 * Upload an image directly to R2 storage with adaptive compression
 * 
 * This helper compresses images client-side and uploads them directly to R2
 * using presigned URLs, avoiding the 5MB Convex action limit.
 * Compression quality is automatically adjusted based on network speed.
 * 
 * @param file - The image file to upload
 * @param generateUploadUrl - Convex mutation to get presigned URL
 * @param syncMetadata - Convex mutation to sync R2 metadata
 * @param onProgress - Optional callback for upload progress (0-100)
 * @returns Storage ID that can be used as image reference
 */
export async function uploadImageToR2(
    file: File,
    generateUploadUrl: () => Promise<string>,
    syncMetadata: (args: { key: string }) => Promise<null>,
    onProgress?: (percent: number) => void
): Promise<string> {
    // Accept common image formats including HEIC/HEIF from iPhones
    const isValidImage =
        file.type.startsWith('image/') ||
        file.name.toLowerCase().endsWith('.heic') ||
        file.name.toLowerCase().endsWith('.heif');

    if (!isValidImage) {
        throw new Error('Please select a valid image file (JPG, PNG, GIF, WebP, HEIC)');
    }

    // Validate file size (max 10MB before compression)
    if (file.size > 10 * 1024 * 1024) {
        throw new Error('Image size must be less than 10MB');
    }

    // Step 1: Compress and convert to WebP with adaptive settings
    // Compression quality adjusts based on network speed for optimal total time
    onProgress?.(10);

    const settings = await getOptimalCompressionSettings();
    const compressedFile = await imageCompression(file, {
        maxSizeMB: settings.maxSizeMB,
        useWebWorker: true,
        fileType: 'image/webp',
        initialQuality: settings.quality,
    });

    onProgress?.(30);

    // Step 2: Get presigned upload URL from Convex
    const uploadUrl = await generateUploadUrl();

    onProgress?.(40);

    // Step 3: Upload directly to R2 with progress tracking
    const xhr = new XMLHttpRequest();

    const uploadPromise = new Promise<void>((resolve, reject) => {
        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const percentComplete = 40 + Math.round((e.loaded / e.total) * 50);
                onProgress?.(percentComplete);
            }
        });

        xhr.addEventListener('load', () => {
            if (xhr.status === 200) {
                resolve();
            } else {
                reject(new Error(`Upload failed with status ${xhr.status}`));
            }
        });

        xhr.addEventListener('error', () => {
            reject(new Error('Upload failed'));
        });

        xhr.addEventListener('abort', () => {
            reject(new Error('Upload cancelled'));
        });

        // Use PUT method for S3/R2 presigned URLs
        xhr.open('PUT', uploadUrl);
        // Set Content-Type to match the compressed file
        xhr.setRequestHeader('Content-Type', 'image/webp');
        xhr.send(compressedFile);
    });

    await uploadPromise;

    onProgress?.(90);

    // Step 4: Extract storage ID from upload URL
    // R2 URL format: https://bucket.r2.cloudflarestorage.com/profiles/{userId}/{uuid}?params...
    // or: https://bucket.r2.cloudflarestorage.com/flyers/{postId}/{uuid}?params...
    // We need to extract the full path (e.g., "profiles/userId/uuid")
    const urlPath = new URL(uploadUrl).pathname;
    // Remove leading slash and get the full path
    const storageId = urlPath.startsWith('/') ? urlPath.slice(1) : urlPath;

    if (!storageId) {
        throw new Error('Failed to extract storage ID from upload URL');
    }

    // Sync metadata with the storage ID (which is the key in R2)
    await syncMetadata({ key: storageId });

    onProgress?.(100);

    // Return storage ID (this is what Convex uses as the image reference)
    return storageId;
}

/**
 * Compress an image without uploading
 * Useful for preview purposes
 */
export async function compressImage(
    file: File,
    onProgress?: (percent: number) => void
): Promise<{ blob: Blob; dataUrl: string }> {
    onProgress?.(10);

    const compressedFile = await imageCompression(file, {
        maxSizeMB: 1,
        useWebWorker: true,
        fileType: 'image/webp',
        initialQuality: 0.9, // 90% quality for crisp display
    });

    onProgress?.(70);

    const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(compressedFile);
    });

    onProgress?.(100);

    return {
        blob: compressedFile,
        dataUrl,
    };
}
