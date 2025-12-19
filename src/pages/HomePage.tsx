import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Header } from "../features/layout/Header";
import { Sidebar } from "../features/layout/Sidebar/index";
import { AdsGrid } from "../features/ads/AdsGrid";
import { useSession } from "@descope/react-sdk";
// AuthModal removed, using global one from Layout

import { useState, useEffect, useCallback } from "react";

import { toast } from "sonner";
import { useNavigate, useSearchParams, useOutletContext } from "react-router-dom";
import { useMarketplace } from "../context/MarketplaceContext";

interface LayoutContext {
  setShowAuthModal: (show: boolean) => void;
}

export function HomePage() {
  const navigate = useNavigate();
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

  // Refresh on mount (when navigating back to home page)
  useEffect(() => {
    // Small delay to ensure ads are loaded first
    const timer = setTimeout(() => {
      refreshAds();
    }, 500);
    return () => clearTimeout(timer);
  }, []); // Empty dependency array = run once on mount

  // Silent refresh when page becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshAds();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [refreshAds]);

  // Clear new ad highlights after 5 seconds
  useEffect(() => {
    if (newAdIds.size > 0) {
      const timer = setTimeout(() => {
        clearNewAdIds();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [newAdIds, clearNewAdIds]);

  return (
    <div className="flex flex-col bg-white min-h-full">
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

      <div className="max-w-[1440px] mx-auto px-4 py-6 w-full">
        <div className="flex gap-8 items-start">
          <div className="hidden md:block sticky top-21 self-start flex-shrink-0">
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
          <div className="flex-1 min-w-0 pb-bottom-nav md:pb-0">
            <AdsGrid
              ads={ads}
              categories={categories || []}
              selectedCategory={selectedCategory}
              sidebarCollapsed={sidebarCollapsed}
              onAdClick={(ad) => navigate(`/ad/${ad._id}`, { state: { initialAd: ad } })}
              isLoading={status === "LoadingFirstPage"}
              isLoadingMore={status === "LoadingMore"}
              newAdIds={newAdIds}
            />

            {/* Load More / Loading Status */}
            <div className="mt-8 flex justify-center">
              {status === "CanLoadMore" && (
                <button
                  onClick={() => loadMore(30)}
                  className="px-6 py-2 bg-white border border-neutral-200 text-neutral-600 rounded-full hover:bg-neutral-50 hover:border-neutral-300 transition-all shadow-sm"
                >
                  Load More Ads
                </button>
              )}
              {status === "Exhausted" && ads && ads.length > 0 && (
                <div className="text-center py-8">
                  <p className="text-neutral-400 text-sm">End of the Board</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
