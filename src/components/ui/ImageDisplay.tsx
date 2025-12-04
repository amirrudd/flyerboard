import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

interface ImageDisplayProps {
  src: string;
  alt: string;
  className?: string;
  fallback?: string;
}

export function ImageDisplay({ src, alt, className, fallback }: ImageDisplayProps) {
  // Check if src is a storage ID (starts with a specific pattern) or a URL
  const needsLookup = Boolean(
    src && !src.startsWith("http") && !src.startsWith("data:")
  );

  // Only fetch storage URL if it's a storage ID
  const storageUrl = useQuery(
    api.posts.getImageUrl,
    needsLookup ? { reference: src } : "skip"
  );

  // Determine the actual image URL to use
  const imageUrl = needsLookup ? storageUrl : src;
  const defaultFallback = fallback || 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=400&h=300&fit=crop';

  return (
    <img
      src={imageUrl || defaultFallback}
      alt={alt}
      className={className}
      onError={(e) => {
        const target = e.target as HTMLImageElement;
        if (target.src !== defaultFallback) {
          target.src = defaultFallback;
        }
      }}
    />
  );
}
