import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Header } from "../features/layout/Header";
import { Sidebar } from "../features/layout/Sidebar";
import { AdsGrid } from "../features/ads/AdsGrid";
import { AuthModal } from "../features/auth/AuthModal";
import { LoadingScreen } from "../components/ui/LoadingScreen";
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

  const [isInitializing, setIsInitializing] = useState(true);
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
    if (categories !== undefined) {
      if (categories.length === 0) {
        clearAndCreateSampleData().then(() => {
          toast.success("Sample data created");
          setIsInitializing(false);
        }).catch((error) => {
          console.error("Error creating sample data:", error);
          setIsInitializing(false);
        });
      } else {
        setIsInitializing(false);
      }
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

  if (isInitializing || categories === undefined) {
    return <LoadingScreen />;
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Temporary admin button for updating categories */}
      <div className="fixed top-4 right-4 z-50 hidden md:block">
        <button
          onClick={handleUpdateCategories}
          className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600 opacity-50 hover:opacity-100 transition-opacity"
        >
          Update Categories
        </button>
      </div>

      <Header
        sidebarCollapsed={sidebarCollapsed}
        setSidebarCollapsed={setSidebarCollapsed}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        user={user}
        setShowAuthModal={setShowAuthModal}
        selectedLocation={selectedLocation}
        setSelectedLocation={handleLocationChange}
        locations={locations}
      />

      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6">
        <div className={`flex gap-3 sm:gap-6 ${sidebarCollapsed ? 'md:gap-6' : 'gap-3 sm:gap-6'}`}>
          {/* Mobile sidebar overlay */}
          {!sidebarCollapsed && (
            <div
              className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
              onClick={() => setSidebarCollapsed(true)}
            />
          )}

          {/* Sidebar */}
          <div className={`${sidebarCollapsed
            ? 'hidden md:block'
            : 'fixed left-0 top-0 h-full w-72 sm:w-80 z-50 md:relative md:w-80 md:z-auto bg-white md:bg-transparent p-3 sm:p-4 md:p-0 pt-16 sm:pt-20 md:pt-0'
            }`}>
            <Sidebar
              sidebarCollapsed={sidebarCollapsed}
              categories={categories || []}
              selectedCategory={selectedCategory}
              setSelectedCategory={handleSetSelectedCategory}
              setSidebarCollapsed={setSidebarCollapsed}
            />
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

      <AuthModal
        showAuthModal={showAuthModal}
        setShowAuthModal={setShowAuthModal}
      />
    </div>
  );
}
