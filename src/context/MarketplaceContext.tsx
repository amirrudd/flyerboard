import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo, useRef } from "react";
import { useQuery, usePaginatedQuery, useConvex } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Doc, Id } from "../../convex/_generated/dataModel";
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
    ads: Doc<"ads">[] | undefined;
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
    const adsCache = useRef<Map<string, Doc<"ads">[]>>(new Map());
    const [cachedAds, setCachedAds] = useState<Doc<"ads">[] | undefined>(undefined);

    // Track new ads for highlighting
    const [newAdIds, setNewAdIds] = useState<Set<string>>(new Set());
    // Initialize to 5 minutes ago to catch recent ads when page loads.
    // The lazy `useState` initializer runs once at mount (keeping render pure),
    // and seeds the per-filter refresh watermarks below.
    const [initialRefreshTimestamp] = useState(() => Date.now() - 5 * 60 * 1000);
    // Ads fetched via refreshAds that the frozen paginated query (bounded by
    // maxCreationTime at mount) can never return. Keyed by filter cacheKey and
    // merged ahead of the query results wherever the display list is rebuilt —
    // otherwise a later refresh or query re-emit rebuilds the list from the raw
    // results and silently drops previously merged new ads.
    const freshAdsRef = useRef<Map<string, Doc<"ads">[]>>(new Map());
    // Per-filter "fetched up to" watermark for getLatestAds. Per-key (not
    // global) so a refresh under one filter doesn't advance the watermark past
    // ads another filter's view hasn't merged yet.
    const lastRefreshTimestamps = useRef<Map<string, number>>(new Map());

    // Generate cache key from current filters
    const cacheKey = useMemo(() => {
        return `${selectedCategory || 'all'}_${searchQuery}_${selectedLocation}`;
    }, [selectedCategory, searchQuery, selectedLocation]);

    // --- Data Fetching ---
    const categories = useQuery(api.categories.getCategories);

    // Stable pagination: freeze the timestamp when the component mounts
    // We do NOT reset this when filters change, to allow caching of previous results.
    // The user can manually refresh the page to get the absolute latest ads.
    const [initialLoadTimestamp] = useState(() => Date.now());

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
                sinceTimestamp: lastRefreshTimestamps.current.get(cacheKey) ?? initialRefreshTimestamp,
                limit: 50,
            });

            if (!latestAds || latestAds.length === 0) {
                return;
            }

            const fresh = freshAdsRef.current.get(cacheKey) ?? [];

            // Find truly new ads (not already merged, not in the query results)
            const knownAdIds = new Set([...fresh, ...(ads || [])].map(ad => ad._id));
            const newAds = latestAds.filter(ad => !knownAdIds.has(ad._id));

            if (newAds.length > 0) {
                // Mark these as new for highlighting
                setNewAdIds(new Set(newAds.map(ad => ad._id)));

                // Accumulate — earlier fresh ads must survive later refreshes,
                // since the paginated query will never return them.
                const updatedFresh = [...newAds, ...fresh];
                freshAdsRef.current.set(cacheKey, updatedFresh);

                // Merge fresh ads at the beginning of the query results
                const mergedAds = [
                    ...updatedFresh,
                    ...(ads || []).filter(ad => !updatedFresh.some(f => f._id === ad._id)),
                ];
                setCachedAds(mergedAds);
                adsCache.current.set(cacheKey, mergedAds);

                // Advance this filter's refresh watermark
                lastRefreshTimestamps.current.set(cacheKey, Date.now());
            }
        } catch (error) {
            console.error('Failed to refresh ads:', error);
        }
    }, [convex, selectedCategory, searchQuery, selectedLocation, ads, cacheKey, initialRefreshTimestamp]);

    // Clear new ad IDs (called after animation or user interaction)
    const clearNewAdIds = useCallback(() => {
        setNewAdIds(new Set());
    }, []);

    // Update cache when new ads are loaded. Fresh ads merged via refreshAds
    // are prepended here too — the paginated query can't see them (created
    // after its frozen maxCreationTime), so rebuilding from `ads` alone would
    // drop them whenever the query re-emits.
    useEffect(() => {
        if (ads && ads.length > 0) {
            const fresh = freshAdsRef.current.get(cacheKey) ?? [];
            const mergedAds = [
                ...fresh,
                ...ads.filter(ad => !fresh.some(f => f._id === ad._id)),
            ];
            adsCache.current.set(cacheKey, mergedAds);
            setCachedAds(mergedAds);
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
        // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing sidebar state to the device viewport (external responsive state) when it changes
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
