import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { LazyLoadImage } from "react-lazy-load-image-component";
import "react-lazy-load-image-component/src/effects/opacity.css";
import { useState, useEffect } from "react";
import { Image as ImageIcon } from "lucide-react";

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
  onClick?: () => void;
  priority?: boolean; // For above-the-fold images (first 6)
}

export function ImageDisplay({ imageRef, src, alt, className = "", onError, onClick, priority = false }: ImageDisplayProps) {
  const [hasError, setHasError] = useState(false);

  // Use imageRef if provided, otherwise fall back to src
  const reference = imageRef || src;

  const imageUrl = useQuery(
    api.posts.getImageUrl,
    reference ? { imageRef: reference } : "skip"
  );

  // Determine the source to display. Prioritize imageUrl from Convex, then fallback to src prop.
  // Note: imageUrl can be null/undefined while loading or if the ref is invalid.
  const displaySrc = imageUrl || src;

  // Handle error state
  const handleError = () => {
    setHasError(true);
    onError?.();
  };

  // Reset error state when displaySrc changes
  useEffect(() => {
    setHasError(false);
  }, [displaySrc]);

  // Show skeleton while loading (or if r2: reference hasn't been converted yet)
  if (!displaySrc || displaySrc.startsWith('r2:')) {
    return (
      <div className={`${className} shimmer bg-gray-200`} aria-label="Loading image" />
    );
  }

  // Show placeholder if image failed to load
  if (hasError) {
    return (
      <div className={`${className} bg-gray-100 flex items-center justify-center`}>
        <ImageIcon className="w-1/3 h-1/3 text-gray-300" />
      </div>
    );
  }

  // Show actual image - no wrapper, matching skeleton structure
  return (
    <LazyLoadImage
      src={displaySrc}
      alt={alt}
      className={className}
      wrapperClassName={className}
      onClick={onClick}
      effect="opacity"
      threshold={300}
      visibleByDefault={priority}
      onError={handleError}
      placeholder={
        <div className={`${className} shimmer bg-gray-200`} aria-label="Loading image" />
      }
    />
  );
}
