import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Sidebar } from "../features/layout/Sidebar/index";
import { AdsGrid } from "../features/ads/AdsGrid";
// AuthModal removed, using global one from Layout
// Header removed too — the persistent default header is rendered by Layout
// (wired straight from MarketplaceContext), so HomePage passes nothing.

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { AdsFilterBar } from "../features/ads/AdsFilterBar";
import { useAdFilters } from "../hooks/useAdFilters";
import { ScrollToTopButton } from "../components/ui/ScrollToTopButton";

import { toast } from "sonner";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { useMarketplace } from "../context/MarketplaceContext";
import { registerHomeScroll, unregisterHomeScroll, HOME_SCROLL_KEY } from "../lib/homeScrollBridge";

export function HomePage() {
  const navigate = useNavigate();
  // Stable identity so AdsGrid's memo isn't broken every render.
  const handleSaleClick = useCallback(
    (slug: string) => { void navigate(`/sale/${slug}`); },
    [navigate]
  );
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const {
    categories,
    selectedCategory,
    setSelectedCategory,
    sidebarCollapsed,
    setSidebarCollapsed,
    isCategoriesLoading,
    feed,
    loadMore,
    status,
    refreshAds,
    newAdIds,
    clearNewAdIds,
    boostedAdKeys,
    clearBoostedAdKeys,
  } = useMarketplace();

  // Price-range filter only. We deliberately never re-sort: the feed is always
  // newest-first because the product's core value is "pin your flyer to the top"
  // — exposing a sort control (esp. by price) would let users bypass that and
  // undercut the model. Filtering by min/max never changes the order.
  const { minPrice, maxPrice } = useAdFilters();

  // One pass over the server-interleaved feed page (order preserved):
  // 1. Price range applies to ad entries only — composite cards are never
  //    price-filtered (they weren't before unification either).
  // 2. Member caps (Moving Sale v3.1 / Bundle v2): individual sale items
  //    render exactly like single listings, so cap how many members of one
  //    Sale (3) or Bundle (2) show — a 4-item bundle would otherwise yield 5
  //    cards from one seller. Category/search results stay uncapped —
  //    "members look like plain listings in search" is a deliberate design
  //    decision (see bundle-listing-design.md).
  const displayFeed = useMemo(() => {
    if (!feed) return feed;
    const counts = new Map<string, number>();
    const underCap = (key: string, max: number) => {
      const n = (counts.get(key) ?? 0) + 1;
      counts.set(key, n);
      return n <= max;
    };
    return feed.filter((entry) => {
      if (entry.kind !== "ad") return true;
      const a = entry.ad;
      if (minPrice !== undefined && !(a.price !== undefined && a.price >= minPrice)) return false;
      if (maxPrice !== undefined && !(a.price !== undefined && a.price <= maxPrice)) return false;
      if (a.saleEventId) return underCap(`sale:${a.saleEventId}`, 3);
      if (a.bundleId) return underCap(`bundle:${a.bundleId}`, 2);
      return true;
    });
  }, [feed, minPrice, maxPrice]);

  // Stable identity so AdsGrid's memo isn't broken every render. Navigates to
  // the bundle's own detail page (the "Deal Ticket", bundle v2) — the bundle
  // is a first-class destination, not a proxy for its first member ad.
  const handleBundleClick = useCallback(
    (card: { _id: string }) => {
      void navigate(`/bundle/${card._id}`);
    },
    [navigate]
  );

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

  // Clear boost-arrival keys after 5 seconds (pin-drop + ring pulse have long
  // finished by then) so a later grid remount doesn't replay the animation.
  useEffect(() => {
    if (boostedAdKeys.size > 0) {
      const timer = setTimeout(() => {
        clearBoostedAdKeys();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [boostedAdKeys, clearBoostedAdKeys]);

  // Preserve scroll position across bottom-nav tab switches.
  // On mobile <main> is the scroll container; on desktop adsFeedRef is — pick
  // whichever actually overflows. The feed grows as ad images load, so a single
  // rAF restore lands too early: scrollTop gets clamped to the not-yet-tall
  // content and stays there. We re-apply across frames until the target is
  // reached or a short deadline passes, and suppress saving while restoring so
  // the clamped intermediate values don't clobber the real saved offset.
  useEffect(() => {
    const feedEl = adsFeedRef.current;
    const mainEl = document.querySelector("main");

    const activeScroller = (): HTMLElement | null => {
      if (feedEl && feedEl.scrollHeight > feedEl.clientHeight) return feedEl;
      if (mainEl && mainEl.scrollHeight > mainEl.clientHeight) return mainEl;
      return null;
    };

    let restoring = false;
    let raf = 0;
    const saved = sessionStorage.getItem(HOME_SCROLL_KEY);
    if (saved) {
      const pos = Number(saved);
      const start = performance.now();
      restoring = true;
      const tick = () => {
        const el = activeScroller();
        if (el) el.scrollTop = pos;
        const reached = !!el && Math.abs(el.scrollTop - pos) <= 1;
        if (!reached && performance.now() - start < 1500) {
          raf = requestAnimationFrame(tick);
        } else {
          restoring = false;
        }
      };
      raf = requestAnimationFrame(tick);
    }

    // Persist the scroll offset, but ignore programmatic focus jumps. Clicking
    // an ad card focuses it, and the browser's scroll-into-view jumps <main> to
    // a new position right before we navigate away — which would otherwise be
    // saved as the user's place. A focus jump is always preceded by `focusin`
    // (which bubbles), so we suppress saving for a brief window after one.
    let suppressUntil = 0;
    const onFocusIn = () => { suppressUntil = performance.now() + 150; };
    const save = (e: Event) => {
      if (restoring) return; // don't persist clamped values mid-restore
      if (performance.now() < suppressUntil) return; // focus-induced jump
      const el = e.currentTarget as HTMLElement;
      // Treat near-top as "no saved position" so a scroll-to-top (whose smooth
      // animation fires trailing scroll events) doesn't leave a stale offset.
      if (el.scrollTop > 4) sessionStorage.setItem(HOME_SCROLL_KEY, String(el.scrollTop));
      else sessionStorage.removeItem(HOME_SCROLL_KEY);
    };
    const scrollers = [feedEl, mainEl].filter(Boolean) as HTMLElement[];
    for (const el of scrollers) {
      el.addEventListener("scroll", save, { passive: true });
      el.addEventListener("focusin", onFocusIn);
    }
    return () => {
      cancelAnimationFrame(raf);
      for (const el of scrollers) {
        el.removeEventListener("scroll", save);
        el.removeEventListener("focusin", onFocusIn);
      }
    };
  }, []);

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

  // Register scroll-to-top so BottomNav can trigger it without direct ref access.
  useEffect(() => {
    registerHomeScroll(handleScrollToTop);
    return () => unregisterHomeScroll();
  }, [handleScrollToTop]);

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
    // md:h-[calc(100%-57px)]: the persistent 57px Header now sits ABOVE this
    // root (rendered by Layout inside <main>), so on desktop the page fills
    // the rest of <main> exactly — total content = header + page = 100%,
    // keeping <main> non-scrollable on md+ (the feed div stays the scroller).
    <div className="flex flex-col bg-background md:h-[calc(100%-57px)]">
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
            // md:overflow-y-auto forces overflow-x:auto — a clip boundary that trims
            // the outer cards' 1px ring. md:px-2 buys room; md:-mx-2 cancels the shift.
            className="flex-1 min-w-0 pb-bottom-nav md:pb-0 md:h-full md:overflow-y-auto md:overscroll-contain md:[scrollbar-gutter:stable] md:px-2 md:-mx-2 scrollbar-hide"
          >
            <AdsFilterBar />
            <AdsGrid
              entries={displayFeed}
              categories={categories || []}
              selectedCategory={selectedCategory}
              sidebarCollapsed={sidebarCollapsed}
              onAdClick={(ad) => { void navigate(`/ad/${ad._id}`, { state: { initialAd: ad } }); }}
              isLoading={status === "LoadingFirstPage"}
              isLoadingMore={status === "LoadingMore"}
              newAdIds={newAdIds}
              boostedAdKeys={boostedAdKeys}
              onSaleClick={handleSaleClick}
              onBundleClick={handleBundleClick}
            />


            {/* Infinite scroll sentinel and loading states */}
            {/* data-testid: masked in e2e visual snapshots — spinner/"End of the
                Board" depend on live pagination status. */}
            <div className="mt-10 flex flex-col items-center" data-testid="feed-status">
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
              {status === "Exhausted" && feed && feed.length > 0 && (
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
