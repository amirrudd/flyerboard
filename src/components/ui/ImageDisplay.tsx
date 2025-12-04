import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState } from "react";
import { LazyLoadImage } from "react-lazy-load-image-component";
import "react-lazy-load-image-component/src/effects/opacity.css";

interface ImageDisplayProps {
  src: string;
  alt: string;
  className?: string;
  fallback?: string;
}

export function ImageDisplay({ src, alt, className, fallback }: ImageDisplayProps) {
  const [hasError, setHasError] = useState(false);

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

  // Show skeleton while fetching storage URL (imageUrl is undefined)
  if (!imageUrl) {
    return (
      <div className={`${className} shimmer bg-gray-200`} aria-label="Loading image" />
    );
  }

  // Show fallback image on error
  if (hasError) {
    return (
      <img
        src={defaultFallback}
        alt={alt}
        className={className}
      />
    );
  }

  // Show actual image with lazy loading and fade-in effect
  return (
    <LazyLoadImage
      src={imageUrl}
      alt={alt}
      className={className}
      effect="opacity"
      placeholder={
        <div className={`${className} shimmer bg-gray-200`} aria-label="Loading image" />
      }
      onError={() => {
        setHasError(true);
      }}
    />
  );
}
