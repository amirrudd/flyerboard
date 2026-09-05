import { Id } from "../../../convex/_generated/dataModel";
import { ImageDisplay } from "../../components/ui/ImageDisplay";
import { SkeletonCard } from "../../components/ui/SkeletonCard";
import { MagnifyingGlass, Repeat, House, Package } from '@phosphor-icons/react';
import { Fragment, memo, useCallback, useRef } from "react";
import { m, LayoutGroup } from "framer-motion";
import { formatPrice } from "../../lib/priceFormatter";
import { useMotionPrefs } from "../../hooks/useMotionPrefs";
import { useDeviceInfo } from "../../hooks/useDeviceInfo";
import { SaleThumbnail } from "../movingSale/SaleThumbnail";
import { BundleThumbnail } from "../bundles/BundleThumbnail";
import { boostArrivalKey, entryKey } from "../../context/freshAdsMerge";
import type { Category, FeedEntry } from "../../context/MarketplaceContext";
import { displayLocation } from "../../lib/locationService";
import { NearbyBoundary } from "./NearbyBoundary";
import { FEED_SECTIONS } from "../../../convex/lib/feedSections";

/**
 * A feed cell is either a normal ad, a Sale card, or a Bundle card. The list
 * arrives pre-interleaved by the server (feed.getFeed, `bumpedAt` desc) and is
 * rendered verbatim — no client-side sorting. The type is DERIVED from the
 * getFeed return type (single source of truth in MarketplaceContext) — a
 * server shape change surfaces here as a compile error, not silent drift.
 */
export type { FeedEntry };

type Ad = Extract<FeedEntry, { kind: "ad" }>["ad"];
/** A whole Sale rendered as one card in the date-sorted feed (v3). */
export type SaleFeedCard = Extract<FeedEntry, { kind: "sale" }>["card"];
/** A whole Bundle rendered as one card in the date-sorted feed. */
export type BundleFeedCard = Extract<FeedEntry, { kind: "bundle" }>["card"];

/** The "New" badge. Composites place it right — top-left holds the type badge. */
const NewBadge = ({ side = "left" }: { side?: "left" | "right" }) => (
  <div
    className={`absolute top-2.5 ${side === "left" ? "left-2.5" : "right-2.5"} bg-primary text-primary-foreground px-2 py-1 rounded-md text-[10px] font-semibold tracking-wider uppercase shadow-md`}
  >
    New
  </div>
);

interface AdsGridProps {
  /** The unified feed page: ads + composite cards, server-interleaved. */
  entries: FeedEntry[] | undefined;
  categories: Category[];
  selectedCategory: Id<"categories"> | null;
  sidebarCollapsed: boolean;
  onAdClick: (ad: Ad) => void;
  isLoading?: boolean;
  isLoadingMore?: boolean;
  newAdIds?: Set<string>;
  /**
   * Boost arrivals from the fresh-rail merge, keyed `${_id}:${bumpedAt}`.
   * Matching cards mount with the pin-drop entrance + ring pulse (and no
   * "New" badge — boosted ads aren't new).
   */
  boostedAdKeys?: Set<string>;
  onSaleClick?: (slug: string) => void;
  onBundleClick?: (card: BundleFeedCard) => void;
  /**
   * The active location preference (canonical string), if any. Rule 5: with a
   * location set the server stamps a `section` on every entry and the grid
   * renders the sections in the order the server gave them, with a boundary
   * before each one after the first.
   */
  selectedLocation?: string;
  onClearLocation?: () => void;
}

export const AdsGrid = memo(function AdsGrid({
  entries,
  categories,
  selectedCategory,
  sidebarCollapsed,
  onAdClick,
  isLoading = false,
  isLoadingMore = false,
  newAdIds = new Set(),
  boostedAdKeys = new Set(),
  onSaleClick,
  onBundleClick,
  selectedLocation,
  onClearLocation,
}: AdsGridProps) {
  const { staggerCard, boostPinDrop, boostRingPulse, reduced } = useMotionPrefs();
  const { isMobile } = useDeviceInfo();

  // Boost arrival: other cards slide down via framer-motion `layout` — DESKTOP
  // ONLY (mobile ships without it: cards reflow instantly, only the arriving
  // card animates). Widen only after a throttled mid-tier profile shows no
  // jank. Skipped under prefers-reduced-motion (layout animations aren't
  // covered by useReducedMotion automatically). Also gated on an active
  // arrival window: both sets clear ~5s after arrivals, so steady-state
  // scrolling pays zero layout-measurement cost while keeping the slide for
  // both boost and brand-new arrivals.
  const animateLayout =
    !isMobile && !reduced && (boostedAdKeys.size > 0 || newAdIds.size > 0);

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

  // Rule 5 (location groups, it doesn't hide): the server names each entry's
  // section and FEED_SECTIONS gives the render order. This grid never asks what
  // a section MEANS — adding, renaming or merging one is a server-side change.
  // A pure filter of the already-ordered list preserves bumpedAt desc within
  // each group. Unsectioned entries (no location set) all land in the first
  // section, so the rest stay empty and no boundary renders. Empty sections are
  // KEPT here: "nothing in the first one" is what switches the boundary to its
  // banner form. The header count deliberately spans every section — everything
  // shown is a listing.
  const sections = FEED_SECTIONS.map((key) => ({
    key,
    items: (entries ?? []).filter((e) => (e.section ?? FEED_SECTIONS[0]) === key),
  }));

  const renderEntry = (entry: FeedEntry, index: number) => {
  // Whole-Sale card — same shell as an ad card, 2×2 thumbnail slot.
  if (entry.kind === "sale") {
    const sale = entry.card;
    const isNew = newAdIds.has(entryKey(entry));
    return (
      <m.article
        key={`sale-${sale._id}`}
        layout={animateLayout}
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
            suburb={displayLocation(sale.suburb)}
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[hsl(25_40%_10%/0.22)] via-[hsl(25_30%_15%/0.08)] to-transparent transition-opacity duration-300 opacity-60 group-hover:opacity-100" />
          <div className="absolute top-2.5 left-2.5 bg-primary text-primary-foreground px-2 py-1 rounded-md text-[10px] font-semibold tracking-wider uppercase shadow-md flex items-center gap-1">
            <House className="w-3 h-3" weight="fill" />
            Moving Sale
          </div>
          {isNew && <NewBadge side="right" />}
        </div>
        <div className="px-3.5 pt-3 pb-3.5">
          <h2 className="font-semibold text-foreground line-clamp-1 text-[15px] tracking-tight">
            {sale.title}
          </h2>
          <div className="mt-1 flex items-baseline justify-between gap-2">
            <p className="text-xs text-muted-foreground line-clamp-1 min-w-0 flex-1">
              {displayLocation(sale.suburb)}
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
      </m.article>
    );
  }

  // Whole-Bundle card — same shell as an ad card, vertical-strip thumbnail slot.
  if (entry.kind === "bundle") {
    const bundle = entry.card;
    const isNew = newAdIds.has(entryKey(entry));
    return (
      <m.article
        key={`bundle-${bundle._id}`}
        layout={animateLayout}
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
          {isNew && <NewBadge side="right" />}
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
              {displayLocation(bundle.location)}
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
      </m.article>
    );
  }

  const ad = entry.ad;
  const isNew = newAdIds.has(entryKey(entry));
  const isPriority = index < 6;
  const isExchange = ad.listingType === "exchange";
  // Boost arrival (one-shot per boost event): the card is keyed on
  // `${_id}:${bumpedAt}`, so a boost replacement remounts it — the
  // pin-drop entrance plays exactly once per boost (a second boost
  // days later re-keys and re-animates; plain re-renders don't).
  const boostKey = boostArrivalKey(ad);
  const isBoostArrival = boostedAdKeys.has(boostKey);

  return (
    <m.article
      key={boostKey}
      layout={animateLayout}
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
      {...(isBoostArrival ? boostPinDrop() : staggerCard(index))}
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
          size="card"
        />

        {/* Warm-tint gradient — always present at rest, deepens on hover */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[hsl(25_40%_10%/0.22)] via-[hsl(25_30%_15%/0.08)] to-transparent transition-opacity duration-300 opacity-60 group-hover:opacity-100" />

        {ad.images.length > 1 && (
          <div className="absolute bottom-2.5 right-2.5 bg-black/55 backdrop-blur-sm text-white px-2 py-0.5 rounded-full text-[11px] font-medium tabular">
            {ad.images.length}
          </div>
        )}
        {isNew && <NewBadge />}
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
            {displayLocation(ad.location)}
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

      {/* Boost ring pulse — opacity-only overlay (never animated
          border/box-shadow: borders shift layout, box-shadow janks).
          Last positioned child so it paints above the card content
          without z-index (a past prod bug was a badge z-index leak).
          ring-inset because the article is overflow-hidden — an
          outset ring would be clipped entirely. */}
      {isBoostArrival && (
        <m.div
          aria-hidden
          data-testid="boost-ring-pulse"
          className="absolute inset-0 rounded-xl ring-2 ring-inset ring-primary pointer-events-none"
          {...boostRingPulse()}
        />
      )}
    </m.article>
  );
  };

  return (
    // data-testid: masked in e2e visual snapshots — everything inside (cards,
    // view counts) is live Convex data and changes run-to-run.
    <section className="flex-1" data-testid="ads-grid">
      {/* Editorial header — kicker over serif display title, with hairline */}
      <header className="mb-7 flex flex-col gap-3">
        <div className="flex items-end justify-between gap-6">
          <div className="flex flex-col gap-1.5">
            <span className="kicker">{headerKicker}</span>
            <h1 className="font-display font-display-var text-3xl sm:text-4xl font-medium text-foreground leading-[1.05] tracking-[-0.02em]">
              {headerTitle}
            </h1>
          </div>
        </div>
        <div className="hairline" />
      </header>

      {/* Loading Skeleton (Initial Load) */}
      {isLoading || entries === undefined ? (
        <div className={gridClasses}>
          {[...Array(12)].map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : (
        <LayoutGroup>
        <div className={`listings-grid ${gridClasses}`}>
          {sections.map(({ key, items }, sectionIndex) => {
            // Running index across sections: the stagger reads as one list.
            const offset = sections
              .slice(0, sectionIndex)
              .reduce((n, s) => n + s.items.length, 0);
            return (
              <Fragment key={key}>
                {sectionIndex > 0 && selectedLocation && items.length > 0 && (
                  <NearbyBoundary
                    location={selectedLocation}
                    hasNearResults={offset > 0}
                    categoryName={categoryName}
                    onClearLocation={onClearLocation}
                  />
                )}
                {items.map((entry, index) => renderEntry(entry, offset + index))}
              </Fragment>
            );
          })}

          {isLoadingMore && (
            [...Array(4)].map((_, i) => (
              <SkeletonCard key={`skeleton-more-${i}`} />
            ))
          )}
        </div>
        </LayoutGroup>
      )}

      {!isLoading && entries && entries.length === 0 && (
        <div className="text-center py-24 sm:py-32">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-muted/60 ring-1 ring-border/60 mb-6">
            <MagnifyingGlass className="w-9 h-9 text-muted-foreground/60" weight="light" />
          </div>
          <h3 className="font-display text-2xl sm:text-3xl font-medium text-foreground mb-2 tracking-tight">
            No Flyers Found
          </h3>
          {/* Rule 5: location no longer narrows (out-of-area entries keep the
              list non-empty), so this state is search/category-shaped — don't
              suggest widening the location. */}
          <p className="text-muted-foreground text-sm max-w-sm mx-auto">
            Try a different search term or clear the active category.
          </p>
        </div>
      )}
    </section>
  );
});
