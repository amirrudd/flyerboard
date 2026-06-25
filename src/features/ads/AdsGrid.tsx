import { Id } from "../../../convex/_generated/dataModel";
import { ImageDisplay } from "../../components/ui/ImageDisplay";
import { SkeletonCard } from "../../components/ui/SkeletonCard";
import { Search, Repeat } from "lucide-react";
import { memo, useCallback } from "react";
import { motion } from "framer-motion";
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

// Cap the staggered entry to the first viewport-worth of cards.
// Anything past this gets an instant fade so paginated loads don't feel slow.
const STAGGER_CAP = 18;
const STAGGER_STEP = 0.028;

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
  const handleAdClick = useCallback((ad: Ad) => {
    onAdClick(ad);
  }, [onAdClick]);

  const gridClasses = `grid gap-4 sm:gap-5 ${sidebarCollapsed
    ? 'grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6'
    : 'grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5'
    }`;

  const categoryName = selectedCategory
    ? categories?.find(c => c._id === selectedCategory)?.name
    : null;

  const headerTitle = categoryName ? `${categoryName} Flyers` : 'All Flyers';
  const headerKicker = categoryName ? 'Category' : 'Marketplace';

  return (
    <section className="flex-1">
      {/* Editorial header — kicker over serif display title, count on right with hairline */}
      <header className="mb-7 flex flex-col gap-3 min-h-[92px]">
        <div className="flex items-end justify-between gap-6">
          <div className="flex flex-col gap-1.5">
            <span className="kicker">{headerKicker}</span>
            <h1 className="font-display text-3xl sm:text-4xl font-medium text-foreground leading-[1.05] tracking-[-0.02em]">
              {headerTitle}
            </h1>
          </div>
          <div className="hidden sm:flex items-baseline gap-2 text-muted-foreground pb-1">
            {ads ? (
              <>
                <span className="tabular text-2xl font-display font-medium text-foreground">
                  {ads.length}
                </span>
                <span className="text-sm">
                  {ads.length === 1 ? 'listing' : 'listings'}
                </span>
              </>
            ) : (
              <div className="h-6 w-24 rounded shimmer" />
            )}
          </div>
        </div>
        <div className="hairline" />
        <div className="text-muted-foreground text-sm tabular sm:hidden">
          {ads ? (
            ads.length === 0
              ? 'No flyers'
              : ads.length === 1
                ? '1 flyer'
                : `${ads.length} flyers`
          ) : (
            <div className="h-5 w-20 rounded shimmer" />
          )}
        </div>
      </header>

      {/* Loading Skeleton (Initial Load) */}
      {isLoading || ads === undefined ? (
        <div className={gridClasses}>
          {[...Array(12)].map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : (
        <div className={`listings-grid ${gridClasses}`}>
          {ads.map((ad, index) => {
            const isNew = newAdIds.has(ad._id);
            const isPriority = index < 6;
            const stagger = index < STAGGER_CAP ? index * STAGGER_STEP : 0;
            const isExchange = ad.listingType === "exchange";

            return (
              <motion.article
                key={ad._id}
                onClick={() => handleAdClick(ad)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleAdClick(ad);
                  }
                }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: stagger,
                  duration: 0.4,
                  ease: [0.2, 0.8, 0.2, 1],
                }}
                className={`listing-card relative bg-card overflow-hidden rounded-xl cursor-pointer group shadow-card ring-1 ${
                  isNew
                    ? 'ring-primary/40'
                    : 'ring-border/70 hover:ring-foreground/15'
                }`}
              >
                <div className="aspect-[4/3] bg-muted/60 overflow-hidden relative">
                  <ImageDisplay
                    src={ad.images[0] || ''}
                    alt={ad.title}
                    className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-[1.025]"
                    priority={isPriority}
                  />

                  {/* Bottom-gradient overlay for badge legibility on bright images */}
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                  {ad.images.length > 1 && (
                    <div className="absolute bottom-2.5 right-2.5 bg-black/55 backdrop-blur-sm text-white px-2 py-0.5 rounded-full text-[11px] font-medium tabular">
                      {ad.images.length}
                    </div>
                  )}
                  {isNew && (
                    <div className="absolute top-2.5 left-2.5 bg-primary text-primary-foreground px-2 py-1 rounded-md text-[10px] font-semibold tracking-wider uppercase shadow-md">
                      New
                    </div>
                  )}
                  {isExchange && !isNew && (
                    <div className="absolute top-2.5 left-2.5 bg-background/85 backdrop-blur-sm text-foreground px-2 py-1 rounded-md text-[10px] font-semibold tracking-wider uppercase flex items-center gap-1 shadow-sm ring-1 ring-border">
                      <Repeat className="w-3 h-3" strokeWidth={2.25} />
                      Trade
                    </div>
                  )}
                </div>

                <div className="px-3.5 pt-3 pb-3.5">
                  <h3 className="font-semibold text-foreground line-clamp-1 text-[15px] tracking-tight">
                    {ad.title}
                  </h3>
                  <div className="mt-1 flex items-baseline justify-between gap-2">
                    <p className="text-xs text-muted-foreground line-clamp-1 min-w-0 flex-1">
                      {ad.location}
                    </p>
                    <div className="flex flex-col items-end flex-shrink-0">
                      {ad.price !== undefined && ad.previousPrice && ad.previousPrice > ad.price && (
                        <p className="text-[11px] text-muted-foreground/80 line-through tabular leading-none mb-0.5">
                          {formatPrice(ad.previousPrice)}
                        </p>
                      )}
                      {(!ad.listingType || ad.listingType === "sale") && ad.price !== undefined && (
                        <p className="font-display text-base font-semibold text-foreground whitespace-nowrap tabular leading-none">
                          {formatPrice(ad.price)}
                        </p>
                      )}
                      {ad.listingType === "exchange" && (
                        <p className="text-[13px] font-semibold text-primary-bright whitespace-nowrap flex items-center gap-1 leading-none">
                          <Repeat className="w-3.5 h-3.5" strokeWidth={2.25} />
                          Open to Trade
                        </p>
                      )}
                      {ad.listingType === "both" && ad.price !== undefined && (
                        <p className="font-display text-base font-semibold text-foreground whitespace-nowrap tabular leading-none">
                          {formatPrice(ad.price)}{' '}
                          <span className="font-sans text-primary-bright text-[10px] font-semibold tracking-wider uppercase align-middle">• Trade</span>
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="mt-2.5 pt-2 border-t border-border/60 text-[11px] text-muted-foreground flex justify-between items-center">
                    <span className="tabular">{ad.views} views</span>
                    <span className="kicker text-[9px] opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-primary">
                      View
                    </span>
                  </div>
                </div>
              </motion.article>
            );
          })}

          {isLoadingMore && (
            [...Array(4)].map((_, i) => (
              <SkeletonCard key={`skeleton-more-${i}`} />
            ))
          )}
        </div>
      )}

      {!isLoading && ads && ads.length === 0 && (
        <div className="text-center py-24 sm:py-32">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-muted/60 ring-1 ring-border/60 mb-6">
            <Search className="w-9 h-9 text-muted-foreground/60" strokeWidth={1.5} />
          </div>
          <h3 className="font-display text-2xl sm:text-3xl font-medium text-foreground mb-2 tracking-tight">
            No Flyers Found
          </h3>
          <p className="text-muted-foreground text-sm max-w-sm mx-auto">
            Try a different search term, widen your location, or clear the active category.
          </p>
        </div>
      )}
    </section>
  );
});
