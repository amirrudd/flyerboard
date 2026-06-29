import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Header } from "../features/layout/Header";
import { Sidebar } from "../features/layout/Sidebar/index";
import { AdsGrid } from "../features/ads/AdsGrid";
import { useSession } from "@descope/react-sdk";
// AuthModal removed, using global one from Layout

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { AdsFilterBar } from "../features/ads/AdsFilterBar";
import { useAdFilters } from "../hooks/useAdFilters";
import { ScrollToTopButton } from "../components/ui/ScrollToTopButton";

import { toast } from "sonner";
import { useNavigate, useSearchParams, useOutletContext, useLocation } from "react-router-dom";
import { useMarketplace } from "../context/MarketplaceContext";

interface LayoutContext {
  setShowAuthModal: (show: boolean) => void;
}

export function HomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { setShowAuthModal } = useOutletContext<LayoutContext>();

  const {
    categories,
    selectedCategory,
    setSelectedCategory,
    searchQuery,
    setSearchQuery,
    selectedLocation,
    setSelectedLocation,
    sidebarCollapsed,
    setSidebarCollapsed,
    isCategoriesLoading,
    ads,
    loadMore,
    status,
    refreshAds,
    newAdIds,
    clearNewAdIds,
  } = useMarketplace();

  // Use Descope session for authentication state
  const { isAuthenticated } = useSession();

  // Price-range filter only. We deliberately never re-sort: the feed is always
  // newest-first because the product's core value is "pin your flyer to the top"
  // — exposing a sort control (esp. by price) would let users bypass that and
  // undercut the model. Filtering by min/max never changes the order.
  const { minPrice, maxPrice } = useAdFilters();

  const filteredAds = useMemo(() => {
    if (!ads) return ads;
    let result = ads;
    if (minPrice !== undefined) result = result.filter(a => a.price !== undefined && a.price >= minPrice);
    if (maxPrice !== undefined) result = result.filter(a => a.price !== undefined && a.price <= maxPrice);
    return result;
  }, [ads, minPrice, maxPrice]);
  // For now, just use a simple user object when authenticated
  // TODO: Fetch actual user data from Convex once Descope integration is complete
  const user = isAuthenticated ? { name: "User" } : null;

  // Handle location change and save to cookies


  const updateCategories = useMutation(api.categories.updateCategories);

  const handleUpdateCategories = useCallback(async () => {
    try {
      const result = await updateCategories();
      toast.success(result.message);
    } catch (error) {
      toast.error("Failed to update categories");
      console.error(error);
    }
  }, [updateCategories]);

  const handleSetSelectedCategory = useCallback((categoryId: Id<"categories"> | null) => {
    setSelectedCategory(categoryId);
    if (categoryId && categories) {
      const category = categories.find(c => c._id === categoryId);
      if (category) {
        setSearchParams({ category: category.slug });
      }
    } else {
      setSearchParams({});
    }
  }, [categories, setSearchParams]);

  // Initialize selectedCategory from URL param using slug lookup
  useEffect(() => {
    if (categories && categories.length > 0) {
      const categorySlug = searchParams.get('category');
      if (categorySlug && categorySlug !== 'all') {
        const category = categories.find(c => c.slug === categorySlug);
        if (category) {
          setSelectedCategory(category._id);
        }
      } else {
        setSelectedCategory(null);
      }
    }
  }, [categories, searchParams]);

  // Silent refresh when page becomes visible (throttled in context - max once per 60s)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void refreshAds(false); // Not forced, will be throttled
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [refreshAds]);

  // Force refresh when navigating back from posting/editing a flyer
  useEffect(() => {
    const state = location.state as { forceRefresh?: boolean } | null;
    if (state?.forceRefresh) {
      void refreshAds(true); // Force refresh to show the new/updated flyer
      // Clear the state to prevent re-triggering on subsequent renders
      void navigate('/', { replace: true, state: {} });
    }
  }, [location.state, refreshAds, navigate]);

  // Clear new ad highlights after 5 seconds
  useEffect(() => {
    if (newAdIds.size > 0) {
      const timer = setTimeout(() => {
        clearNewAdIds();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [newAdIds, clearNewAdIds]);

  // Scroll-to-top — one listener per scroll container; only the active one fires per breakpoint
  const adsFeedRef = useRef<HTMLDivElement>(null);
  const mainElRef = useRef<Element | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const feedEl = adsFeedRef.current;
    const mainEl = document.querySelector("main");
    mainElRef.current = mainEl;
    const onScroll = (e: Event) =>
      setShowScrollTop((e.currentTarget as Element).scrollTop > 600);
    feedEl?.addEventListener("scroll", onScroll, { passive: true });
    mainEl?.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      feedEl?.removeEventListener("scroll", onScroll);
      mainEl?.removeEventListener("scroll", onScroll);
    };
  }, []);

  const handleScrollToTop = useCallback(() => {
    adsFeedRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    mainElRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // Infinite scroll with IntersectionObserver
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Only load if intersecting and can load more
        if (entries[0].isIntersecting && status === "CanLoadMore") {
          loadMore(30);
        }
      },
      {
        rootMargin: '500px', // Load 500px before reaching sentinel
        threshold: 0.1
      }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [status, loadMore]);

  return (
    <div className="flex flex-col bg-background md:h-full">
      <Header
        sidebarCollapsed={sidebarCollapsed}
        setSidebarCollapsed={setSidebarCollapsed}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        user={user}
        setShowAuthModal={setShowAuthModal}
        selectedLocation={selectedLocation}
        setSelectedLocation={setSelectedLocation}
      />

      <div className="content-max-width mx-auto container-padding py-6 w-full md:flex-1 md:min-h-0 md:py-0 md:pt-6">
        <div className="flex gap-8 items-start md:h-full">
          <div className="hidden md:block self-start flex-shrink-0">
            <Sidebar
              sidebarCollapsed={sidebarCollapsed}
              categories={categories || []}
              selectedCategory={selectedCategory}
              setSelectedCategory={handleSetSelectedCategory}
              setSidebarCollapsed={setSidebarCollapsed}
              isLoading={isCategoriesLoading}
            />
          </div>

          {/* Main Content - Feed */}
          <div
            ref={adsFeedRef}
            className="flex-1 min-w-0 pb-bottom-nav md:pb-0 md:h-full md:overflow-y-auto md:overscroll-contain md:[scrollbar-gutter:stable] scrollbar-hide"
          >
            <AdsFilterBar />
            <AdsGrid
              ads={filteredAds}
              categories={categories || []}
              selectedCategory={selectedCategory}
              sidebarCollapsed={sidebarCollapsed}
              onAdClick={(ad) => { void navigate(`/ad/${ad._id}`, { state: { initialAd: ad } }); }}
              isLoading={status === "LoadingFirstPage"}
              isLoadingMore={status === "LoadingMore"}
              newAdIds={newAdIds}
            />


            {/* Infinite scroll sentinel and loading states */}
            <div className="mt-10 flex flex-col items-center">
              {/* Sentinel element for IntersectionObserver */}
              <div ref={loadMoreSentinelRef} className="h-4" />

              {/* Loading spinner when loading more */}
              {status === "LoadingMore" && (
                <div className="py-4 flex items-center gap-3 text-muted-foreground">
                  <div className="inline-block animate-spin rounded-full h-5 w-5 border-2 border-border border-t-primary" />
                  <span className="kicker">Loading more</span>
                </div>
              )}

              {/* End of results */}
              {status === "Exhausted" && ads && ads.length > 0 && (
                <div className="text-center py-12 flex flex-col items-center gap-3 w-full max-w-xs">
                  <div className="flex items-center gap-3 w-full">
                    <div className="hairline flex-1" />
                    <span className="kicker shrink-0">End of the Board</span>
                    <div className="hairline flex-1" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <ScrollToTopButton visible={showScrollTop} onClick={handleScrollToTop} />
    </div>
  );
}
