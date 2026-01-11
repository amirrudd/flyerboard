import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo, useRef } from "react";
import { useQuery, usePaginatedQuery, useConvex } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import Cookies from "js-cookie";
import { useDeviceInfo } from "../hooks/useDeviceInfo";

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
    refreshAds: (forceRefresh?: boolean) => Promise<void>;
    newAdIds: Set<string>;
    clearNewAdIds: () => void;
}

const MarketplaceContext = createContext<MarketplaceContextType | undefined>(undefined);

export function MarketplaceProvider({ children }: { children: ReactNode }) {
    const { isMobile } = useDeviceInfo();

    // --- State ---
    const [selectedCategory, setSelectedCategory] = useState<Id<"categories"> | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedLocation, setSelectedLocation] = useState(() => {
        const savedLocation = Cookies.get("selectedLocation");
        return savedLocation !== undefined ? savedLocation : "";
    });

    // Initialize sidebar state based on device
    const [sidebarCollapsed, setSidebarCollapsed] = useState(isMobile);

    // --- Client-Side Cache ---
    // Cache ads by filter combination to prevent reloads when switching categories
    const adsCache = useRef<Map<string, any[]>>(new Map());
    const [cachedAds, setCachedAds] = useState<any[] | undefined>(undefined);

    // Track new ads for highlighting
    const [newAdIds, setNewAdIds] = useState<Set<string>>(new Set());
    // Initialize to 5 minutes ago to catch recent ads when page loads
    const lastRefreshTimestamp = useRef<number>(Date.now() - 5 * 60 * 1000);

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

    // Query for latest ads (for refresh) - REMOVED continuous subscription
    // Now using on-demand query via useConvex below

    // --- On-demand refresh with throttling ---
    const convex = useConvex();
    const lastRefreshTime = useRef<number>(0);
    const REFRESH_THROTTLE_MS = 60000; // 60 seconds

    // Refresh function to fetch and merge new ads
    // forceRefresh=true bypasses throttle (used after creating/editing/deleting flyers)
    const refreshAds = useCallback(async (forceRefresh = false) => {
        const now = Date.now();

        // Skip if refresh was called too recently (unless forced)
        if (!forceRefresh && now - lastRefreshTime.current < REFRESH_THROTTLE_MS) {
            return;
        }

        lastRefreshTime.current = now;

        try {
            // Fetch latest ads on-demand (not subscription)
            const latestAds = await convex.query(api.ads.getLatestAds, {
                categoryId: selectedCategory ?? undefined,
                search: searchQuery || undefined,
                location: selectedLocation || undefined,
                sinceTimestamp: lastRefreshTimestamp.current,
                limit: 50,
            });

            if (!latestAds || latestAds.length === 0) {
                return;
            }

            // Get current ad IDs
            const currentAdIds = new Set((ads || []).map(ad => ad._id));

            // Find truly new ads (not in current list)
            const newAds = latestAds.filter(ad => !currentAdIds.has(ad._id));

            if (newAds.length > 0) {
                // Mark these as new for highlighting
                setNewAdIds(new Set(newAds.map(ad => ad._id)));

                // Merge new ads at the beginning
                const mergedAds = [...newAds, ...(ads || [])];
                setCachedAds(mergedAds);
                adsCache.current.set(cacheKey, mergedAds);

                // Update last refresh timestamp
                lastRefreshTimestamp.current = Date.now();
            }
        } catch (error) {
            console.error('Failed to refresh ads:', error);
        }
    }, [convex, selectedCategory, searchQuery, selectedLocation, ads, cacheKey]);

    // Clear new ad IDs (called after animation or user interaction)
    const clearNewAdIds = useCallback(() => {
        setNewAdIds(new Set());
    }, []);

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

    // Handle responsive sidebar behavior - sync with device changes
    useEffect(() => {
        setSidebarCollapsed(isMobile);
    }, [isMobile]);

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
        refreshAds,
        newAdIds,
        clearNewAdIds,
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
