import { Id } from "../../../convex/_generated/dataModel";
import { ImageDisplay } from "../../components/ui/ImageDisplay";
import { SkeletonCard } from "../../components/ui/SkeletonCard";
import { Search, Repeat } from "lucide-react";
import { memo, useCallback } from "react";
import { formatPrice } from "../../lib/priceFormatter";

interface Ad {
  _id: Id<"ads">;
  title: string;
  description: string;
  listingType?: "sale" | "exchange" | "both";
  price?: number;
  previousPrice?: number;
  exchangeDescription?: string;
  location: string;
  categoryId: Id<"categories">;
  images: string[];
  userId: Id<"users">;
  isActive: boolean;
  views: number;
}

interface Category {
  _id: Id<"categories">;
  name: string;
  slug: string;
  parentId?: Id<"categories">;
}

interface AdsGridProps {
  ads: Ad[] | undefined;
  categories: Category[];
  selectedCategory: Id<"categories"> | null;
  sidebarCollapsed: boolean;
  onAdClick: (ad: Ad) => void;
  isLoading?: boolean;
  isLoadingMore?: boolean;
  newAdIds?: Set<string>;
}

export const AdsGrid = memo(function AdsGrid({
  ads,
  categories,
  selectedCategory,
  sidebarCollapsed,
  onAdClick,
  isLoading = false,
  isLoadingMore = false,
  newAdIds = new Set(),
}: AdsGridProps) {
  // Optimize onClick handler with useCallback
  const handleAdClick = useCallback((ad: Ad) => {
    onAdClick(ad);
  }, [onAdClick]);

  const gridClasses = `grid gap-3 sm:gap-4 ${sidebarCollapsed
    ? 'grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6'
    : 'grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5'
    }`;

  return (
    <div className="flex-1">
      <div className="mb-6 flex flex-col gap-1 min-h-[92px]">
        <h2 className="text-2xl font-bold text-foreground">
          {selectedCategory
            ? `${categories?.find(c => c._id === selectedCategory)?.name} Flyers`
            : 'All Flyers'}
        </h2>
        <div className="text-muted-foreground text-sm">
          <div className="h-5 flex items-center">
            {ads ? (
              <>
                {ads.length === 0
                  ? 'No flyers'
                  : ads.length === 1
                    ? '1 flyer'
                    : `${ads.length} flyers`}
              </>
            ) : (
              <div className="h-5 w-20 rounded shimmer" />
            )}
          </div>
        </div>
      </div>

      {/* Loading Skeleton (Initial Load) */}
      {isLoading || ads === undefined ? (
        <div className={gridClasses}>
          {[...Array(12)].map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : (
        /* Listings Grid with CSS transitions for better performance */
        <div className={`listings-grid ${gridClasses}`}>
          {ads.map((ad, index) => {
            const isNew = newAdIds.has(ad._id);
            const isPriority = index < 6; // First 6 images are priority
            return (
              <div
                key={ad._id}
                onClick={() => handleAdClick(ad)}
                className={`listing-card bg-card border rounded-xl overflow-hidden shadow-sm hover:border-accent transition-all duration-200 cursor-pointer group ${isNew ? 'border-primary animate-fade-in' : 'border-border'
                  }`}
              >
                <div className="aspect-[4/3] bg-muted overflow-hidden relative">
                  <ImageDisplay
                    src={ad.images[0] || ''}
                    alt={ad.title}
                    className="w-full h-full object-contain"
                    priority={isPriority}
                  />
                  {ad.images.length > 1 && (
                    <div className="absolute bottom-2 right-2 bg-black/60 text-white px-1.5 py-0.5 rounded text-xs font-medium">
                      {ad.images.length}
                    </div>
                  )}
                  {isNew && (
                    <div className="absolute top-2 left-2 bg-primary text-white px-2 py-1 rounded text-xs font-semibold shadow-md">
                      NEW
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <h3 className="font-medium text-foreground mb-1 line-clamp-1 text-sm sm:text-base">
                    {ad.title}
                  </h3>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <p className="text-xs sm:text-sm text-muted-foreground line-clamp-1 flex-1 min-w-0">
                      {ad.location}
                    </p>
                    <div className="flex flex-col items-start sm:items-end flex-shrink-0">
                      {/* Previous price strikethrough - only for sale/both with price reduction */}
                      {ad.price !== undefined && ad.previousPrice && ad.previousPrice > ad.price && (
                        <p className="text-xs text-muted-foreground line-through">
                          {formatPrice(ad.previousPrice)}
                        </p>
                      )}
                      {/* Price display based on listing type */}
                      {(!ad.listingType || ad.listingType === "sale") && ad.price !== undefined && (
                        <p className="text-sm font-medium text-foreground whitespace-nowrap">
                          {formatPrice(ad.price)}
                        </p>
                      )}
                      {ad.listingType === "exchange" && (
                        <p className="text-sm font-medium text-primary-bright whitespace-nowrap flex items-center gap-1">
                          <Repeat className="w-3.5 h-3.5" />
                          Open to Trade
                        </p>
                      )}
                      {ad.listingType === "both" && ad.price !== undefined && (
                        <p className="text-sm font-medium text-foreground whitespace-nowrap">
                          {formatPrice(ad.price)} <span className="text-primary-bright text-xs">• Trade</span>
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground flex justify-between items-center">
                    <span>{ad.views} views</span>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Loading More Skeletons */}
          {isLoadingMore && (
            [...Array(4)].map((_, i) => (
              <SkeletonCard key={`skeleton-more-${i}`} />
            ))
          )}
        </div>
      )}

      {!isLoading && ads && ads.length === 0 && (
        <div className="text-center py-32">
          <div className="flex justify-center mb-4">
            <Search className="w-16 h-16 text-muted-foreground/30" strokeWidth={1.5} />
          </div>
          <h3 className="text-xl font-semibold text-foreground mb-2">No Flyers Found</h3>
          <p className="text-muted-foreground">Try adjusting your search or filters</p>
        </div>
      )}
    </div>
  );
});
