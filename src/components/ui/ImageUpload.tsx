import { useState, useRef, useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { toast } from "sonner";
import { ImageDisplay } from "./ImageDisplay";

interface ImageUploadProps {
  images: string[];
  onImagesChange: (images: string[]) => void;
  maxImages?: number;
}

export function ImageUpload({ images, onImagesChange, maxImages = 10 }: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generateUploadUrl = useMutation(api.posts.generateUploadUrl);

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
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      uploadFiles(files);
    }
    // Reset input value to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const uploadFiles = async (files: File[]) => {
    const remainingSlots = maxImages - images.length;
    const filesToUpload = files.slice(0, remainingSlots);

    if (files.length > remainingSlots) {
      toast.warning(`Only uploading first ${remainingSlots} images (${maxImages} max)`);
    }

    const uploadPromises = filesToUpload.map(async (file) => {
      const fileId = Math.random().toString(36).substring(7);
      setUploading(prev => [...prev, fileId]);

      try {
        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
          throw new Error(`${file.name} is too large. Maximum size is 5MB.`);
        }

        // Generate upload URL
        const uploadUrl = await generateUploadUrl();

        // Upload file
        const result = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });

        if (!result.ok) {
          throw new Error(`Failed to upload ${file.name}`);
        }

        const { storageId } = await result.json();

        // Return the storage ID directly - we'll handle URL generation in the backend
        return storageId;
      } catch (error: any) {
        toast.error(error.message || `Failed to upload ${file.name}`);
        return null;
      } finally {
        setUploading(prev => prev.filter(id => id !== fileId));
      }
    });

    const uploadedUrls = await Promise.all(uploadPromises);
    const validUrls = uploadedUrls.filter(url => url !== null) as string[];

    if (validUrls.length > 0) {
      onImagesChange([...images, ...validUrls]);
      toast.success(`Successfully uploaded ${validUrls.length} image${validUrls.length > 1 ? 's' : ''}`);
    }
  };

  const removeImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    onImagesChange(newImages);
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
            ${uploading.length > 0 ? 'opacity-50' : ''}
          `}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
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
                disabled={uploading.length > 0}
                className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {uploading.length > 0 ? 'Uploading...' : 'Choose Files'}
              </button>
            </div>
            <p className="text-xs text-gray-400">
              Supports: JPG, PNG, GIF, WebP • Max size: 5MB each • Max {maxImages} images
            </p>
          </div>
        </div>
      )}

      {/* Upload Progress */}
      {uploading.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
            <span className="text-sm text-blue-700">
              Uploading {uploading.length} image{uploading.length > 1 ? 's' : ''}...
            </span>
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {images.map((imageId, index) => (
            <div key={index} className="relative group">
              <ImageDisplay
                src={imageId}
                alt={`Preview ${index + 1}`}
                className="w-full h-24 object-cover rounded-lg border border-neutral-200"
              />
              <button
                type="button"
                onClick={() => removeImage(index)}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Remove image"
              >
                ×
              </button>
              {index === 0 && (
                <div className="absolute bottom-1 left-1 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
                  Main
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {images.length === 0 && uploading.length === 0 && (
        <div className="text-center py-4">
          <p className="text-neutral-500 text-sm">No images added yet</p>
        </div>
      )}
    </div>
  );
}
