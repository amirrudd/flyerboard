import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo, useRef } from "react";
import { useQuery, useMutation, usePaginatedQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import Cookies from "js-cookie";
import { toast } from "sonner";
import { throttle } from "../lib/performanceUtils";

interface Category {
    _id: Id<"categories">;
    name: string;
    slug: string;
    parentId?: Id<"categories">;
}

interface MarketplaceContextType {
    categories: Category[] | undefined;
    selectedCategory: Id<"categories"> | null;
    setSelectedCategory: (id: Id<"categories"> | null) => void;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    selectedLocation: string;
    setSelectedLocation: (location: string) => void;
    sidebarCollapsed: boolean;
    setSidebarCollapsed: (collapsed: boolean) => void;
    isCategoriesLoading: boolean;
    ads: any; // Ideally import { Doc } from ...
    loadMore: (numItems: number) => void;
    status: "CanLoadMore" | "LoadingMore" | "Exhausted" | "LoadingFirstPage";
}

const MarketplaceContext = createContext<MarketplaceContextType | undefined>(undefined);

export function MarketplaceProvider({ children }: { children: ReactNode }) {
    // --- State ---
    const [selectedCategory, setSelectedCategory] = useState<Id<"categories"> | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedLocation, setSelectedLocation] = useState(() => {
        const savedLocation = Cookies.get("selectedLocation");
        return savedLocation !== undefined ? savedLocation : "";
    });

    // Initialize sidebar state based on screen size
    const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
        if (typeof window !== 'undefined') {
            return window.innerWidth < 768; // Collapsed on mobile, expanded on desktop
        }
        return false; // Default to expanded
    });

    // --- Client-Side Cache ---
    // Cache ads by filter combination to prevent reloads when switching categories
    const adsCache = useRef<Map<string, any[]>>(new Map());
    const [cachedAds, setCachedAds] = useState<any[] | undefined>(undefined);

    // Generate cache key from current filters
    const cacheKey = useMemo(() => {
        return `${selectedCategory || 'all'}_${searchQuery}_${selectedLocation}`;
    }, [selectedCategory, searchQuery, selectedLocation]);

    // --- Data Fetching ---
    const categories = useQuery(api.categories.getCategories);

    // Stable pagination: freeze the timestamp when the component mounts
    // We do NOT reset this when filters change, to allow caching of previous results.
    // The user can manually refresh the page to get the absolute latest ads.
    const [initialLoadTimestamp] = useState(Date.now());

    const { results: ads, status, loadMore } = usePaginatedQuery(
        api.ads.getAds,
        {
            categoryId: selectedCategory ?? undefined,
            search: searchQuery || undefined,
            location: selectedLocation || undefined,
            maxCreationTime: initialLoadTimestamp,
        },
        { initialNumItems: 30 }
    );

    // Update cache when new ads are loaded
    useEffect(() => {
        if (ads && ads.length > 0) {
            adsCache.current.set(cacheKey, ads);
            setCachedAds(ads);
        }
    }, [ads, cacheKey]);

    // Load from cache when filters change
    useEffect(() => {
        const cached = adsCache.current.get(cacheKey);
        if (cached) {
            // Show cached data immediately
            setCachedAds(cached);
        } else {
            // No cache, show loading state
            setCachedAds(undefined);
        }
    }, [cacheKey]);

    const displayAds = cachedAds || ads;

    // --- Effects ---

    // Handle responsive sidebar behavior with throttled resize
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth < 768) {
                // Mobile: collapse sidebar
                setSidebarCollapsed(true);
            } else {
                // Desktop: expand sidebar
                setSidebarCollapsed(false);
            }
        };

        // Throttle resize handler to fire at most every 150ms
        const throttledResize = throttle(handleResize, 150);

        window.addEventListener('resize', throttledResize);
        return () => window.removeEventListener('resize', throttledResize);
    }, []);

    // Handle location change and save to cookies
    const handleSetSelectedLocation = useCallback((location: string) => {
        setSelectedLocation(location);
        Cookies.set("selectedLocation", location, { expires: 365 });
    }, []);

    // Note: Sample data creation removed for production safety
    // To create sample data in local development, use the Convex dashboard
    // to manually call the clearAndCreateSampleData mutation

    const value = {
        categories,
        selectedCategory,
        setSelectedCategory,
        searchQuery,
        setSearchQuery,
        selectedLocation,
        setSelectedLocation: handleSetSelectedLocation,
        sidebarCollapsed,
        setSidebarCollapsed,
        isCategoriesLoading: categories === undefined,
        ads: displayAds, // Use cached ads for instant display
        loadMore,
        status,
    };

    return (
        <MarketplaceContext.Provider value={value}>
            {children}
        </MarketplaceContext.Provider>
    );
}

export function useMarketplace() {
    const context = useContext(MarketplaceContext);
    if (context === undefined) {
        throw new Error("useMarketplace must be used within a MarketplaceProvider");
    }
    return context;
}
