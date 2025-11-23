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

export function HomePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Initialize sidebar state based on screen size
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768; // Collapsed on mobile, expanded on desktop
    }
    return false; // Default to expanded
  });

  const [selectedCategory, setSelectedCategory] = useState<Id<"categories"> | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLocation, setSelectedLocation] = useState(() => {
    const savedLocation = Cookies.get("selectedLocation");
    return savedLocation !== undefined ? savedLocation : "Melbourne, CBD";
  });


  const [showAuthModal, setShowAuthModal] = useState(false);

  const user = useQuery(api.auth.loggedInUser);
  const categories = useQuery(api.categories.getCategories);
  const ads = useQuery(api.ads.getAds, {
    categoryId: selectedCategory ?? undefined,
    search: searchQuery || undefined,
    location: selectedLocation && selectedLocation !== "" ? selectedLocation : undefined,
  });

  const clearAndCreateSampleData = useMutation(api.sampleData.clearAndCreateSampleData);
  const updateCategories = useMutation(api.categories.updateCategories);

  useEffect(() => {
    if (categories !== undefined && categories.length === 0) {
      clearAndCreateSampleData().then(() => {
        toast.success("Sample data created");
      }).catch((error) => {
        console.error("Error creating sample data:", error);
      });
    }
  }, [categories, clearAndCreateSampleData]);

  // Handle responsive sidebar behavior
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setSidebarCollapsed(true); // Always collapsed on mobile
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close auth modal when user logs in
  useEffect(() => {
    if (user && showAuthModal) {
      setShowAuthModal(false);
      toast.success("Successfully signed in");
    }
  }, [user, showAuthModal]);

  // Handle location change and save to cookies
  const handleLocationChange = useCallback((location: string) => {
    setSelectedLocation(location);
    Cookies.set("selectedLocation", location, { expires: 365 });
  }, []);

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
        setSelectedLocation={handleLocationChange}
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
              isLoading={categories === undefined}
            />
          </div>

          {/* Main Content - Feed */}
          <div className="flex-1 min-w-0">
            {/* Mobile Category Toggle (if needed, or keep existing mobile logic) */}
            <div className="md:hidden mb-4">
              {/* We can add a mobile category filter button here later if needed */}
            </div>

            <AdsGrid
              ads={ads || []}
              categories={categories || []}
              selectedCategory={selectedCategory}
              sidebarCollapsed={sidebarCollapsed}
              onAdClick={(adId) => navigate(`/ad/${adId}`)}
            />
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
