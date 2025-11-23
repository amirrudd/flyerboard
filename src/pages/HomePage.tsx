import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Header } from "../features/layout/Header";
import { Sidebar } from "../features/layout/Sidebar";
import { AdsGrid } from "../features/ads/AdsGrid";
import { AuthModal } from "../features/auth/AuthModal";

import { useState, useEffect, useCallback } from "react";

import { toast } from "sonner";
import Cookies from "js-cookie";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMarketplace } from "../context/MarketplaceContext";

export function HomePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

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


  const [showAuthModal, setShowAuthModal] = useState(false);

  const user = useQuery(api.auth.loggedInUser);

  // Stale-while-revalidate pattern for ads
  // This ensures we keep showing the old ads while fetching new ones, avoiding a flash of loading state
  const [displayedAds, setDisplayedAds] = useState<typeof ads>(undefined);

  useEffect(() => {
    if (ads !== undefined) {
      setDisplayedAds(ads);
    }
  }, [ads]);



  // Close auth modal when user logs in
  useEffect(() => {
    if (user && showAuthModal) {
      setShowAuthModal(false);
      toast.success("Successfully signed in");
    }
  }, [user, showAuthModal]);

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

  const locations = [
    "Sydney, CBD",
    "Sydney, Northern Beaches",
    "Melbourne, CBD",
    "Melbourne, South Yarra",
    "Brisbane, South Bank",
    "Brisbane, Fortitude Valley",
    "Perth, Fremantle",
    "Perth, Subiaco",
    "Adelaide, CBD",
    "Gold Coast, Surfers Paradise",
    "Canberra, City Centre",
  ];



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
        <div className="flex gap-8 items-start min-h-screen">
          {/* Sidebar - Sticky on Desktop */}
          <div className={`
            ${sidebarCollapsed ? 'hidden' : 'hidden md:block'}
            w-64 flex-shrink-0 sticky top-[84px] h-[calc(100vh-84px)] overflow-y-auto scrollbar-hide
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

          {/* Main Content - Feed */}
          <div className="flex-1 min-w-0">
            {/* Mobile Category Toggle (if needed, or keep existing mobile logic) */}
            <div className="md:hidden mb-4">
              {/* We can add a mobile category filter button here later if needed */}
            </div>

            <AdsGrid
              ads={displayedAds}
              categories={categories || []}
              selectedCategory={selectedCategory}
              sidebarCollapsed={sidebarCollapsed}
              onAdClick={(ad) => navigate(`/ad/${ad._id}`, { state: { initialAd: ad } })}
              isLoading={status === "LoadingFirstPage"}
            />

            {/* Load More / Loading Status */}
            <div className="mt-8 flex justify-center">
              {status === "LoadingMore" && (
                <div className="flex items-center gap-2 text-neutral-500">
                  <div className="w-4 h-4 border-2 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
                  <span>Loading more ads...</span>
                </div>
              )}
              {status === "CanLoadMore" && (
                <button
                  onClick={() => loadMore(30)}
                  className="px-6 py-2 bg-white border border-neutral-200 text-neutral-600 rounded-full hover:bg-neutral-50 hover:border-neutral-300 transition-all shadow-sm"
                >
                  Load More Ads
                </button>
              )}
              {status === "Exhausted" && ads && ads.length > 0 && (
                <p className="text-neutral-400 text-sm">No more ads to load</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <AuthModal
        showAuthModal={showAuthModal}
        setShowAuthModal={setShowAuthModal}
      />
    </div>
  );
}
