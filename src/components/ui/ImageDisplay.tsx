import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { LazyLoadImage } from "react-lazy-load-image-component";
import "react-lazy-load-image-component/src/effects/opacity.css";
import { useState, useEffect } from "react";
import { Image as ImageIcon } from '@phosphor-icons/react';
import { resolvePublicImageUrl } from "@/lib/imageUrl";

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
  // When true, off-ratio images are shown in full (object-contain) on top of a
  // blurred, scaled copy of themselves so the box is always filled — no empty
  // letterbox bars and no cropping. Opt-in; used by the browse grid.
  // NOTE: this renders an `absolute inset-0` layer, so the PARENT must be
  // positioned (e.g. `relative`). AdsGrid's `aspect-[4/3] relative` box provides it.
  backdrop?: boolean;
}

export function ImageDisplay({ imageRef, src, alt, className = "", onError, onClick, priority = false, backdrop = false }: ImageDisplayProps) {
  const [hasError, setHasError] = useState(false);

  // Use imageRef if provided, otherwise fall back to src
  const reference = imageRef || src;

  // Prefer a stable public URL (CDN-cacheable) when one can be resolved
  // locally — this skips the Convex round trip entirely and, more
  // importantly, avoids minting a fresh presigned URL on every mount (which
  // defeats the browser HTTP cache). Falls back to the query when the R2
  // custom domain isn't configured (VITE_R2_PUBLIC_URL unset) or the ref is
  // a legacy Convex `_storage` id.
  const publicUrl = resolvePublicImageUrl(reference);

  const imageUrl = useQuery(
    api.posts.getImageUrl,
    reference && !publicUrl ? { imageRef: reference } : "skip"
  );

  // Determine the source to display. Prioritize the resolved public URL, then
  // the Convex query result, then fallback to src prop.
  // Note: imageUrl can be null/undefined while loading or if the ref is invalid.
  const displaySrc = publicUrl || imageUrl || src;

  // Handle error state
  const handleError = () => {
    setHasError(true);
    onError?.();
  };

  // Reset error state when displaySrc changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHasError(false);
  }, [displaySrc]);

  // Show skeleton while loading (or if r2: reference hasn't been converted yet)
  if (!displaySrc || displaySrc.startsWith('r2:')) {
    return (
      <div className={`${className} shimmer bg-muted`} aria-label="Loading image" />
    );
  }

  // Show placeholder if image failed to load
  if (hasError) {
    return (
      <div className={`${className} bg-muted flex items-center justify-center`}>
        <ImageIcon className="w-1/3 h-1/3 text-muted-foreground/30" />
      </div>
    );
  }

  // The resolved image element, shared by the plain and backdrop render paths.
  // In backdrop mode the wrapper owns positioning and the parent div owns the
  // click target, so onClick lives on the wrapper there instead of the image.
  const image = (
    <LazyLoadImage
      src={displaySrc}
      alt={alt}
      className={className}
      wrapperClassName={backdrop ? "absolute inset-0 z-[1]" : className}
      onClick={backdrop ? undefined : onClick}
      effect="opacity"
      threshold={300}
      visibleByDefault={priority}
      onError={handleError}
      placeholder={
        <div className={`${className} shimmer bg-muted`} aria-label="Loading image" />
      }
    />
  );

  // Blurred backdrop fill: the contained image over a blurred, scaled copy of
  // itself. Same URL, so the browser serves the backdrop from cache. Fills any
  // aspect ratio without cropping the subject. Requires a positioned parent.
  if (backdrop) {
    return (
      <div className="absolute inset-0 overflow-hidden" onClick={onClick}>
        <img
          src={displaySrc}
          alt=""
          aria-hidden="true"
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-80"
        />
        {image}
      </div>
    );
  }

  return image;
}
