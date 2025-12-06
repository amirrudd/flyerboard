import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { LazyLoadImage } from "react-lazy-load-image-component";
import "react-lazy-load-image-component/src/effects/opacity.css";

interface ImageDisplayProps {
  // New prop (preferred)
  imageRef?: string | null | undefined;
  // Old props (backward compatibility)
  src?: string;
  alt: string;
  className?: string;
  fallback?: string;
  variant?: "small" | "large";
  onError?: () => void;
}

export function ImageDisplay({ imageRef, src, alt, className = "", onError }: ImageDisplayProps) {
  // Use imageRef if provided, otherwise fall back to src
  const reference = imageRef || src;

  const imageUrl = useQuery(
    api.posts.getImageUrl,
    reference ? { imageRef: reference } : "skip"
  );

  // Show skeleton while loading
  if (!imageUrl) {
    return (
      <div className={`${className} shimmer bg-gray-200`} aria-label="Loading image" />
    );
  }

  // Show actual image with lazy loading and fade-in effect
  return (
    <LazyLoadImage
      src={imageUrl}
      alt={alt}
      className={className}
      wrapperClassName={className}
      style={{ width: '100%', height: '100%', display: 'block' }}
      effect="opacity"
      onError={onError}
      placeholder={
        <div className={`${className} shimmer bg-gray-200`} aria-label="Loading image" />
      }
    />
  );
}
