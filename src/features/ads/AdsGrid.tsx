import { Id } from "../../../convex/_generated/dataModel";
import { ImageDisplay } from "../../components/ui/ImageDisplay";
import { SkeletonCard } from "../../components/ui/SkeletonCard";
import { Search } from "lucide-react";
import { memo, useCallback } from "react";

interface Ad {
  _id: Id<"ads">;
  title: string;
  description: string;
  price: number;
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
}

export const AdsGrid = memo(function AdsGrid({
  ads,
  categories,
  selectedCategory,
  sidebarCollapsed,
  onAdClick,
  isLoading = false,
  isLoadingMore = false,
}: AdsGridProps) {
  // Optimize onClick handler with useCallback
  const handleAdClick = useCallback((ad: Ad) => {
    onAdClick(ad);
  }, [onAdClick]);

  const gridClasses = `grid gap-3 sm:gap-4 ${sidebarCollapsed
    ? 'grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
    : 'grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
    }`;

  return (
    <div className="flex-1">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-[#333333] mb-6">
          {selectedCategory
            ? `${categories?.find(c => c._id === selectedCategory)?.name} Flyers`
            : 'All Flyers'}
        </h2>
        <div className="text-neutral-500 text-sm mb-4">
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
              <div className="h-4 w-20 rounded shimmer" />
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
          {ads.map((ad) => (
            <div
              key={ad._id}
              onClick={() => handleAdClick(ad)}
              className="listing-card bg-white border border-gray-200 rounded-md overflow-hidden hover:border-gray-300 transition-all duration-200 cursor-pointer group"
            >
              <div className="aspect-[4/3] bg-gray-100 overflow-hidden relative">
                <ImageDisplay
                  src={ad.images[0] || ''}
                  alt={ad.title}
                  className="w-full h-full object-contain"
                  variant="medium"
                />
                {ad.images.length > 1 && (
                  <div className="absolute bottom-2 right-2 bg-black/60 text-white px-1.5 py-0.5 rounded text-xs font-medium">
                    {ad.images.length}
                  </div>
                )}
              </div>
              <div className="p-3">
                <h3 className="font-medium text-gray-900 mb-1 line-clamp-1 text-sm sm:text-base">
                  {ad.title}
                </h3>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-0">
                  <p className="text-xs sm:text-sm text-gray-500 line-clamp-1">
                    {ad.location}
                  </p>
                  <p className="text-sm font-medium text-gray-900">
                    ${ad.price.toLocaleString()}
                  </p>
                </div>
                <div className="mt-2 text-xs text-gray-400 flex justify-between items-center">
                  <span>{ad.views} views</span>
                </div>
              </div>
            </div>
          ))}

          {/* Loading More Skeletons */}
          {isLoadingMore && (
            [...Array(4)].map((_, i) => (
              <SkeletonCard key={`skeleton-more-${i}`} />
            ))
          )}
        </div>
      )}

      {!isLoading && ads && ads.length === 0 && (
        <div className="text-center py-12">
          <div className="flex justify-center mb-4">
            <Search className="w-16 h-16 text-gray-300" strokeWidth={1.5} />
          </div>
          <h3 className="text-xl font-semibold text-[#333333] mb-2">No Flyers Found</h3>
          <p className="text-neutral-500">Try adjusting your search or filters</p>
        </div>
      )}
    </div>
  );
});
