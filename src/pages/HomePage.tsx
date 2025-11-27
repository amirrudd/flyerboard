import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Header } from "../features/layout/Header";
import { Sidebar } from "../features/layout/Sidebar";
import { AdsGrid } from "../features/ads/AdsGrid";
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
  } = useMarketplace();

  const user = useQuery(api.auth.loggedInUser);

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

  return (
    <div className="min-h-screen bg-white">


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

      <div className="max-w-[1440px] mx-auto px-4 py-6">
        <div className="flex gap-8 items-start">
          {/* Sidebar - Sticky on Desktop, Fixed Overlay on Mobile */}
          {!sidebarCollapsed && (
            <>
              {/* Mobile Overlay Backdrop */}
              <div
                className="md:hidden fixed inset-0 bg-black/50 z-[60]"
                onClick={() => setSidebarCollapsed(true)}
              />

              {/* Sidebar */}
              <div className={`
                fixed md:sticky top-0 md:top-[84px] left-0 md:left-auto
                h-screen md:h-[calc(100vh-84px)]
                w-64 md:w-64
                bg-white md:bg-transparent
                shadow-2xl md:shadow-none
                overflow-y-auto scrollbar-hide
                z-[70] md:z-auto
                flex-shrink-0
                transition-transform duration-300
                pt-4 md:pt-0
              `}>
                <Sidebar
                  sidebarCollapsed={sidebarCollapsed}
                  categories={categories || []}
                  selectedCategory={selectedCategory}
                  setSelectedCategory={handleSetSelectedCategory}
                  setSidebarCollapsed={setSidebarCollapsed}
                  isLoading={isCategoriesLoading}
                />
              </div>
            </>
          )}

          {/* Main Content - Feed */}
          <div className="flex-1 min-w-0 pb-20 md:pb-0">
            <AdsGrid
              ads={ads}
              categories={categories || []}
              selectedCategory={selectedCategory}
              sidebarCollapsed={sidebarCollapsed}
              onAdClick={(ad) => navigate(`/ad/${ad._id}`, { state: { initialAd: ad } })}
              isLoading={status === "LoadingFirstPage"}
              isLoadingMore={status === "LoadingMore"}
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
