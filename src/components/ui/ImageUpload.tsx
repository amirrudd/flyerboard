import { useState, useRef, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { ImageDisplay } from "./ImageDisplay";
import imageCompression from 'browser-image-compression';
import { Trash2 } from "lucide-react";
import { getOptimalCompressionSettings, type CompressionSettings } from "../../lib/networkSpeed";

interface ImageState {
  id: string;
  preview: string; // Original file preview (data URL)
  file: File; // Original file
  compressed: File | null; // Compressed file when ready
  status: 'compressing' | 'ready' | 'error';
  error?: string;
}

interface ImageUploadProps {
  images: string[];
  onImagesChange: (images: string[]) => void;
  onFilesSelected?: (files: Array<{ dataUrl: string, type: string }>) => void;
  onCompressionStateChange?: (states: Map<string, ImageState>) => void;
  maxImages?: number;
}

export function ImageUpload({
  images,
  onImagesChange,
  onFilesSelected,
  onCompressionStateChange,
  maxImages = 10
}: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [imageStates, setImageStates] = useState<Map<string, ImageState>>(new Map());
  const [compressionSettings, setCompressionSettings] = useState<CompressionSettings | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Detect network speed on mount
  useEffect(() => {
    getOptimalCompressionSettings().then(settings => {
      setCompressionSettings(settings);
      console.log('Adaptive compression:', settings.label);
    });
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));

    if (imageFiles.length > 0) {
      uploadFiles(imageFiles);
    }
  }, [images.length]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      uploadFiles(files);
    }
    // Reset input value to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [images.length]);

  const uploadFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);

    if (images.length + fileArray.length > maxImages) {
      toast.error(`Maximum ${maxImages} images allowed`);
      return;
    }

    const newPreviews: string[] = [];
    const newStates = new Map(imageStates);

    // Process each file
    for (const file of fileArray) {
      // Check file size before processing
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} is too large (max 10MB)`);
        continue;
      }

      // Accept common image formats including HEIC/HEIF from iPhones
      const isValidImage =
        file.type.startsWith('image/') ||
        file.name.toLowerCase().endsWith('.heic') ||
        file.name.toLowerCase().endsWith('.heif');

      if (!isValidImage) {
        toast.error(`${file.name} is not a supported image format`);
        continue;
      }

      try {
        // Generate unique ID for this image
        const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Create immediate preview from original file
        const preview = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        // Add to previews immediately
        newPreviews.push(preview);

        // Initialize state as compressing
        const imageState: ImageState = {
          id,
          preview,
          file,
          compressed: null,
          status: 'compressing',
        };
        newStates.set(id, imageState);

        // Start compression in background (non-blocking)
        compressImageInBackground(id, file, newStates);
      } catch (error) {
        console.error('Failed to process file:', file.name, error);
        toast.error(`Failed to process ${file.name}`);
      }
    }

    // Update state immediately with previews
    if (newPreviews.length > 0) {
      onImagesChange([...images, ...newPreviews]);
      setImageStates(newStates);
      onCompressionStateChange?.(newStates);
      toast.success(`Added ${newPreviews.length} image${newPreviews.length > 1 ? 's' : ''} - compressing in background...`);
    }
  };

  const compressImageInBackground = async (
    id: string,
    file: File,
    states: Map<string, ImageState>
  ) => {
    try {
      // Use adaptive compression settings, fallback to balanced if not ready
      const settings = compressionSettings || { quality: 0.88, maxSizeMB: 10, label: 'Balanced' };

      // Compress and convert to WebP (handles HEIC/HEIF automatically)
      // WebP format provides progressive-like loading inherently
      const compressedFile = await imageCompression(file, {
        maxSizeMB: settings.maxSizeMB,
        maxWidthOrHeight: 2048, // Preserve resolution, prevent downscaling
        useWebWorker: true,
        fileType: 'image/webp',
        initialQuality: settings.quality,
      });

      // Update state to ready
      setImageStates(prev => {
        const newStates = new Map(prev);
        const state = newStates.get(id);
        if (state) {
          state.compressed = compressedFile;
          state.status = 'ready';
          newStates.set(id, state);
        }
        onCompressionStateChange?.(newStates);
        return newStates;
      });
    } catch (error) {
      console.error('Failed to compress image:', error);

      // Update state to error
      setImageStates(prev => {
        const newStates = new Map(prev);
        const state = newStates.get(id);
        if (state) {
          state.status = 'error';
          state.error = error instanceof Error ? error.message : 'Compression failed';
          newStates.set(id, state);
        }
        onCompressionStateChange?.(newStates);
        return newStates;
      });
    }
  };

  const removeImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    onImagesChange(newImages);

    // Also remove from imageStates
    const statesArray = Array.from(imageStates.values());
    if (statesArray[index]) {
      const newStates = new Map(imageStates);
      newStates.delete(statesArray[index].id);
      setImageStates(newStates);
      onCompressionStateChange?.(newStates);
    }
  };

  const canUploadMore = images.length < maxImages;

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      {canUploadMore && (
        <div
          className={`
            border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200
            ${isDragging
              ? 'border-primary-600 bg-orange-50'
              : 'border-neutral-300 hover:border-gray-400'
            }
          `}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.heic,.heif"
            onChange={handleFileSelect}
            className="hidden"
          />

          <div className="space-y-4">
            <div className="text-4xl">📸</div>
            <div>
              <p className="text-lg font-medium text-neutral-700 mb-2">
                {isDragging ? 'Drop images here' : 'Upload Images'}
              </p>
              <p className="text-sm text-neutral-500 mb-4">
                Drag and drop images here, or click to select files
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 transition-colors"
              >
                Choose Files
              </button>
            </div>
            <p className="text-xs text-gray-400">
              Supports: JPG, PNG, GIF, WebP, HEIC • Max size: 10MB each • Max {maxImages} images
            </p>
          </div>
        </div>
      )}

      {/* Image Counter */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-600">
          {images.length}/{maxImages} images added
        </p>
        {images.length >= maxImages && (
          <p className="text-sm text-orange-600">Maximum images reached</p>
        )}
      </div>

      {/* Image Preview Grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {images.map((image, index) => (
            <div key={index} className="relative group">
              <div className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                <ImageDisplay
                  src={image}
                  alt={`Upload ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>
              <button
                onClick={() => removeImage(index)}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-7 h-7 flex items-center justify-center hover:bg-red-600 transition-colors shadow-md"
                title="Remove image"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {images.length === 0 && (
        <div className="text-center py-4">
          <p className="text-neutral-500 text-sm">No images added yet</p>
        </div>
      )}
    </div>
  );
}
