import { useState, useRef, useCallback } from "react";
import { toast } from "sonner";
import { ImageDisplay } from "./ImageDisplay";
import imageCompression from 'browser-image-compression';
import { Trash2 } from "lucide-react";

interface ImageUploadProps {
  images: string[];
  onImagesChange: (images: string[]) => void;
  onFilesSelected?: (files: Array<{ dataUrl: string, type: string }>) => void;
  maxImages?: number;
}

export function ImageUpload({ images, onImagesChange, onFilesSelected, maxImages = 10 }: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const uploadFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);

    if (images.length + fileArray.length > maxImages) {
      toast.error(`Maximum ${maxImages} images allowed`);
      return;
    }

    setIsCompressing(true);
    toast.info(`Compressing ${fileArray.length} image${fileArray.length > 1 ? 's' : ''}...`);
    const selectedFileData: Array<{ dataUrl: string, type: string }> = [];

    for (const file of fileArray) {
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} is not an image`);
        continue;
      }

      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} is too large (max 10MB)`);
        continue;
      }

      try {
        // Compress and convert to WebP
        const compressedFile = await imageCompression(file, {
          maxSizeMB: 1,
          useWebWorker: true,
          fileType: 'image/webp',
          initialQuality: 0.8,
        });

        // Convert to base64 for preview and upload
        const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(compressedFile);
        });

        // Add to preview images
        onImagesChange([...images, base64Data]);

        // Store file data for later upload
        selectedFileData.push({
          dataUrl: base64Data,
          type: 'image/webp'
        });
      } catch (error) {
        console.error('Failed to process file:', error);
        toast.error(`Failed to process ${file.name}`);
      }
    }

    setIsCompressing(false);

    // Pass selected files to parent
    if (onFilesSelected && selectedFileData.length > 0) {
      onFilesSelected(selectedFileData);
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
                disabled={isCompressing}
                className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isCompressing ? 'Compressing...' : 'Choose Files'}
              </button>
            </div>
            <p className="text-xs text-gray-400">
              Supports: JPG, PNG, GIF, WebP • Max size: 5MB each • Max {maxImages} images
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
                <img
                  src={image}
                  alt={`Upload ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>
              <button
                onClick={() => removeImage(index)}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-7 h-7 flex items-center justify-center hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
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
