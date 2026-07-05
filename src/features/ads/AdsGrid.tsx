import { Id } from "../../../convex/_generated/dataModel";
import { ImageDisplay } from "../../components/ui/ImageDisplay";
import { SkeletonCard } from "../../components/ui/SkeletonCard";
import { MagnifyingGlass, Repeat, House, Package } from '@phosphor-icons/react';
import { memo, useCallback, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { formatPrice } from "../../lib/priceFormatter";
import { useMotionPrefs } from "../../hooks/useMotionPrefs";
import { SaleThumbnail } from "../movingSale/SaleThumbnail";
import { BundleThumbnail } from "../bundles/BundleThumbnail";

interface Ad {
  _id: Id<"ads">;
  _creationTime?: number;
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
  saleEventId?: Id<"saleEvents">;
}

/** A whole Sale rendered as one card in the date-sorted feed (v3). */
export interface SaleFeedCard {
  _id: string;
  slug: string;
  title: string;
  suburb: string;
  createdAt: number;
  itemCount: number;
  photoCount: number;
  minPrice: number;
  covers: string[];
}

/** A whole Bundle rendered as one card in the date-sorted feed. */
export interface BundleFeedCard {
  _id: string;
  label: string;
  createdAt: number;
  itemCount: number;
  location: string;
  bundlePrice: number;
  separatelyTotal: number;
  savings: number;
  covers: string[];
  adIds: string[];
}

/** A feed cell is either a normal ad, a Sale card, or a Bundle card; merged by date. */
type FeedEntry =
  | { kind: "ad"; sortKey: number; ad: Ad }
  | { kind: "sale"; sortKey: number; sale: SaleFeedCard }
  | { kind: "bundle"; sortKey: number; bundle: BundleFeedCard };

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
  /** Whole-Sale cards, interleaved into the same date-sorted grid. */
  saleCards?: SaleFeedCard[];
  onSaleClick?: (slug: string) => void;
  /** Whole-Bundle cards, interleaved into the same date-sorted grid. */
  bundleCards?: BundleFeedCard[];
  onBundleClick?: (card: BundleFeedCard) => void;
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
  saleCards = [],
  onSaleClick,
  bundleCards = [],
  onBundleClick,
}: AdsGridProps) {
  const { staggerCard } = useMotionPrefs();

  // Merge ads + Sale cards + Bundle cards into one date-sorted feed (newest
  // first). The sort rule is unchanged — Sale/Bundle cards simply slot in at
  // their own creation date.
  const feed = useMemo<FeedEntry[]>(() => {
    const adEntries: FeedEntry[] = (ads ?? []).map((ad) => ({
      kind: "ad",
      sortKey: ad._creationTime ?? 0,
      ad,
    }));
    const saleEntries: FeedEntry[] = saleCards.map((sale) => ({
      kind: "sale",
      sortKey: sale.createdAt,
      sale,
    }));
    const bundleEntries: FeedEntry[] = bundleCards.map((bundle) => ({
      kind: "bundle",
      sortKey: bundle.createdAt,
      bundle,
    }));
    return [...adEntries, ...saleEntries, ...bundleEntries].sort((a, b) => b.sortKey - a.sortKey);
  }, [ads, saleCards, bundleCards]);

  const handleAdClick = useCallback((ad: Ad) => {
    onAdClick(ad);
  }, [onAdClick]);

  const rafRef = useRef<number>(0);
  const handleSpotlightMove = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const el = e.currentTarget;
    const x = e.clientX;
    const y = e.clientY;
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const rect = el.getBoundingClientRect();
      el.style.setProperty('--spotlight-x', `${x - rect.left}px`);
      el.style.setProperty('--spotlight-y', `${y - rect.top}px`);
    });
  }, []);

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
    // data-testid: masked in e2e visual snapshots — everything inside (listing
    // count, cards, view counts) is live Convex data and changes run-to-run.
    <section className="flex-1" data-testid="ads-grid">
      {/* Editorial header — kicker over serif display title, count on right with hairline */}
      <header className="mb-7 flex flex-col gap-3 min-h-[92px]">
        <div className="flex items-end justify-between gap-6">
          <div className="flex flex-col gap-1.5">
            <span className="kicker">{headerKicker}</span>
            <h1 className="font-display font-display-var text-3xl sm:text-4xl font-medium text-foreground leading-[1.05] tracking-[-0.02em]">
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
          {feed.map((entry, index) => {
            // Whole-Sale card — same shell as an ad card, 2×2 thumbnail slot.
            if (entry.kind === "sale") {
              const sale = entry.sale;
              return (
                <motion.article
                  key={`sale-${sale._id}`}
                  onClick={() => onSaleClick?.(sale.slug)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSaleClick?.(sale.slug);
                    }
                  }}
                  onMouseMove={handleSpotlightMove}
                  {...staggerCard(index)}
                  className="spotlight-card listing-card relative bg-card overflow-hidden rounded-xl cursor-pointer group shadow-card ring-1 ring-border/70 hover:ring-foreground/15"
                >
                  <div className="aspect-[4/3] bg-muted/60 overflow-hidden relative">
                    <SaleThumbnail
                      covers={sale.covers}
                      photoCount={sale.photoCount}
                      itemCount={sale.itemCount}
                      suburb={sale.suburb}
                    />
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[hsl(25_40%_10%/0.22)] via-[hsl(25_30%_15%/0.08)] to-transparent transition-opacity duration-300 opacity-60 group-hover:opacity-100" />
                    <div className="absolute top-2.5 left-2.5 bg-primary text-primary-foreground px-2 py-1 rounded-md text-[10px] font-semibold tracking-wider uppercase shadow-md flex items-center gap-1">
                      <House className="w-3 h-3" weight="fill" />
                      Moving Sale
                    </div>
                  </div>
                  <div className="px-3.5 pt-3 pb-3.5">
                    <h2 className="font-semibold text-foreground line-clamp-1 text-[15px] tracking-tight">
                      {sale.title}
                    </h2>
                    <div className="mt-1 flex items-baseline justify-between gap-2">
                      <p className="text-xs text-muted-foreground line-clamp-1 min-w-0 flex-1">
                        {sale.suburb}
                      </p>
                      <p className="font-display text-base font-semibold text-foreground whitespace-nowrap tabular leading-none flex-shrink-0">
                        {sale.minPrice > 0 ? `from ${formatPrice(sale.minPrice)}` : 'Moving sale'}
                      </p>
                    </div>
                    <div className="mt-2.5 pt-2 border-t border-border/60 text-[11px] text-muted-foreground flex justify-between items-center">
                      <span className="tabular">{sale.itemCount} items</span>
                      <span className="kicker text-[9px] opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-primary">
                        View sale
                      </span>
                    </div>
                  </div>
                </motion.article>
              );
            }

            // Whole-Bundle card — same shell as an ad card, vertical-strip thumbnail slot.
            if (entry.kind === "bundle") {
              const bundle = entry.bundle;
              return (
                <motion.article
                  key={`bundle-${bundle._id}`}
                  onClick={() => onBundleClick?.(bundle)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onBundleClick?.(bundle);
                    }
                  }}
                  onMouseMove={handleSpotlightMove}
                  {...staggerCard(index)}
                  className="spotlight-card listing-card relative bg-card overflow-hidden rounded-xl cursor-pointer group shadow-card ring-1 ring-border/70 hover:ring-foreground/15"
                >
                  <div className="aspect-[4/3] bg-muted/60 overflow-hidden relative">
                    <BundleThumbnail covers={bundle.covers} itemCount={bundle.itemCount} />
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[hsl(25_40%_10%/0.22)] via-[hsl(25_30%_15%/0.08)] to-transparent transition-opacity duration-300 opacity-60 group-hover:opacity-100" />
                    <div className="absolute top-2.5 left-2.5 bg-bundle text-white px-2 py-1 rounded-md text-[10px] font-semibold tracking-wider uppercase shadow-md flex items-center gap-1">
                      <Package className="w-3 h-3" weight="fill" />
                      Bundle
                    </div>
                    {bundle.savings > 0 && (
                      <div className="absolute bottom-2.5 right-2.5 bg-bundle text-white px-2 py-0.5 rounded-full text-[11px] font-medium tabular shadow-md">
                        Save {formatPrice(bundle.savings)}
                      </div>
                    )}
                  </div>
                  <div className="px-3.5 pt-3 pb-3.5">
                    <h2 className="font-semibold text-foreground line-clamp-1 text-[15px] tracking-tight">
                      {bundle.label}
                    </h2>
                    <div className="mt-1 flex items-baseline justify-between gap-2">
                      <p className="text-xs text-muted-foreground line-clamp-1 min-w-0 flex-1">
                        {bundle.location}
                      </p>
                      <div className="flex flex-col items-end flex-shrink-0">
                        {bundle.separatelyTotal > bundle.bundlePrice && (
                          <p className="text-[11px] text-muted-foreground/80 line-through tabular leading-none mb-0.5">
                            {formatPrice(bundle.separatelyTotal)}
                          </p>
                        )}
                        <p className="font-display text-base font-semibold text-foreground whitespace-nowrap tabular leading-none">
                          {formatPrice(bundle.bundlePrice)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2.5 pt-2 border-t border-border/60 text-[11px] text-muted-foreground flex justify-between items-center">
                      <span className="tabular">{bundle.itemCount} items</span>
                      <span className="kicker text-[9px] opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-primary">
                        View bundle
                      </span>
                    </div>
                  </div>
                </motion.article>
              );
            }

            const ad = entry.ad;
            const isNew = newAdIds.has(ad._id);
            const isPriority = index < 6;
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
                onMouseMove={handleSpotlightMove}
                {...staggerCard(index)}
                className={`spotlight-card listing-card relative bg-card overflow-hidden rounded-xl cursor-pointer group shadow-card ring-1 ${
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
                    backdrop
                  />

                  {/* Warm-tint gradient — always present at rest, deepens on hover */}
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[hsl(25_40%_10%/0.22)] via-[hsl(25_30%_15%/0.08)] to-transparent transition-opacity duration-300 opacity-60 group-hover:opacity-100" />

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
                      <Repeat className="w-3 h-3" weight="bold" />
                      Trade
                    </div>
                  )}
                </div>

                <div className="px-3.5 pt-3 pb-3.5">
                  <h2 className="font-semibold text-foreground line-clamp-1 text-[15px] tracking-tight">
                    {ad.title}
                  </h2>
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
                          <Repeat className="w-3.5 h-3.5" weight="bold" />
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
                  {/* v3.1: sale items are NOT differentiated in the feed — they
                      render exactly like any single listing. Sale discovery happens
                      on the ad detail page banner (and the whole-Sale card above). */}
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
            <MagnifyingGlass className="w-9 h-9 text-muted-foreground/60" weight="light" />
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
