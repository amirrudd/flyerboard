import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo, useRef } from "react";
import { useQuery, usePaginatedQuery, useConvex } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Doc, Id } from "../../convex/_generated/dataModel";
import Cookies from "js-cookie";
import { useDeviceInfo } from "../hooks/useDeviceInfo";
import { classifyLatestAds, mergeFreshRail, mergeAheadOfQuery, nextWatermark } from "./freshAdsMerge";

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
    /**
     * One-shot boost arrivals from the latest merge, keyed `${_id}:${bumpedAt}`
     * (so a second boost days later re-triggers, but re-renders don't).
     * Drives the pin-drop entrance + ring pulse in AdsGrid — deliberately
     * separate from newAdIds: boosted ads get NO "New" badge.
     */
    boostedAdKeys: Set<string>;
    clearBoostedAdKeys: () => void;
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
    // Track boost arrivals (`${_id}:${bumpedAt}` keys) for the pin-drop
    // entrance — separate from newAdIds because boosted ads get no New badge.
    const [boostedAdKeys, setBoostedAdKeys] = useState<Set<string>>(new Set());
    // Initialize to 5 minutes ago to catch recent ads when page loads.
    // The lazy `useState` initializer runs once at mount (keeping render pure),
    // and seeds the per-filter refresh watermarks below.
    const [initialRefreshTimestamp] = useState(() => Date.now() - 5 * 60 * 1000);
    // Ads fetched via refreshAds that the frozen paginated query (bounded by
    // maxSortTime at mount) can never return. Keyed by filter cacheKey and
    // merged ahead of the query results wherever the display list is rebuilt —
    // otherwise a later refresh or query re-emit rebuilds the list from the raw
    // results and silently drops previously merged new ads.
    //
    // Boost (Jul 2026): the sort key (`bumpedAt`) is now MUTABLE. A boost moves
    // an ad above the frozen bound, so the reactive paginated query ejects it
    // from open sessions; this rail is its only way back (as a replacement
    // entry that shadows the stale copy by _id — see freshAdsMerge.ts).
    //
    // Known accepted limitations (plan 2-2.6, revisit only if reports surface):
    // - Entries here are one-shot snapshots: a boosted ad that is then
    //   sold/edited stays stale at the top of the feed until remount/refresh.
    //   Pre-existing behavior for brand-new ads, now slightly more exposed.
    // - Between the boost's reactive ejection and the next refresh tick
    //   (≤60s), the boosted ad is transiently absent from open feeds. The
    //   watermark rule + interval tick guarantee recovery; only *permanent*
    //   disappearance (the 8cf9b00 bug class) is designed against.
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
            maxSortTime: initialLoadTimestamp,
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
    // forceRefresh=true bypasses throttle (used after creating/editing/deleting flyers).
    //
    // Boost (Phase 3 hook): after a successful `boostAd` mutation, invoke this
    // forced-refresh path so the booster sees their ad jump — either call
    // `refreshAds(true)` directly via useMarketplace(), or navigate home with
    // `state: { forceRefresh: true }` (the post-create pattern HomePage already
    // handles). Same mechanism, don't build a parallel one.
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

            // Replacement-aware dedupe (Boost, Jul 2026): an unknown _id is a
            // brand-new ad; a known _id whose bumpedAt is newer than the held
            // copy is a BOOST replacement (an _id-only dedupe would drop it —
            // the 8cf9b00 vanishing-ads bug class); a known, unchanged _id is
            // a plain duplicate and is dropped. Fresh rail first: its copy is
            // always at least as new as the paginated query's.
            const { brandNew, boosted } = classifyLatestAds(latestAds, [...fresh, ...(ads || [])]);
            const merged = [...brandNew, ...boosted];

            if (merged.length > 0) {
                if (brandNew.length > 0) {
                    // Mark only genuinely new ads for the "New" badge.
                    setNewAdIds(new Set(brandNew.map(ad => ad._id)));
                }
                if (boosted.length > 0) {
                    // Boost arrivals get the pin-drop entrance instead of the
                    // badge — keyed on `${_id}:${bumpedAt}` (one-shot per boost).
                    setBoostedAdKeys(new Set(boosted.map(ad => `${ad._id}:${ad.bumpedAt}`)));
                }

                // Accumulate — earlier fresh ads must survive later refreshes,
                // since the paginated query will never return them. Boost
                // replacements shadow their stale prior copies by _id.
                const updatedFresh = mergeFreshRail(fresh, brandNew, boosted);
                freshAdsRef.current.set(cacheKey, updatedFresh);

                // Merge fresh ads at the beginning of the query results (the
                // fresh copy wins by _id, dropping any stale paginated copy).
                const mergedAds = mergeAheadOfQuery(updatedFresh, ads || []);
                setCachedAds(mergedAds);
                adsCache.current.set(cacheKey, mergedAds);

                // Advance this filter's refresh watermark to max(bumpedAt of
                // merged results) — never Date.now(), which could advance past
                // a boost racing the query snapshot and skip it for good.
                lastRefreshTimestamps.current.set(
                    cacheKey,
                    nextWatermark(
                        lastRefreshTimestamps.current.get(cacheKey) ?? initialRefreshTimestamp,
                        merged
                    )
                );
            }
        } catch (error) {
            console.error('Failed to refresh ads:', error);
        }
    }, [convex, selectedCategory, searchQuery, selectedLocation, ads, cacheKey, initialRefreshTimestamp]);

    // Clear new ad IDs (called after animation or user interaction)
    const clearNewAdIds = useCallback(() => {
        setNewAdIds(new Set());
    }, []);

    // Clear boost-arrival keys (called after the pin-drop/ring pulse has
    // played, so remounts of the grid don't replay the animation).
    const clearBoostedAdKeys = useCallback(() => {
        setBoostedAdKeys(new Set());
    }, []);

    // Same-tab recovery tick (Boost, Jul 2026): a boost moves an ad's bumpedAt
    // above the frozen maxSortTime bound, so the reactive paginated query
    // ejects it from this session; the fresh rail is its only way back. The
    // visibilitychange trigger (HomePage) never fires for a user who keeps the
    // tab visible, so tick the (still 60s-throttled) refresh on the same
    // cadence while the tab is visible. Un-forced: the throttle stays the
    // rate-limiting authority.
    useEffect(() => {
        const intervalId = setInterval(() => {
            if (document.visibilityState === "visible") {
                void refreshAds(false);
            }
        }, REFRESH_THROTTLE_MS);
        return () => clearInterval(intervalId);
    }, [refreshAds]);

    // Update cache when new ads are loaded. Fresh ads merged via refreshAds
    // are prepended here too — the paginated query can't see them (created or
    // boosted past its frozen maxSortTime), so rebuilding from `ads` alone
    // would drop them whenever the query re-emits. The fresh copy wins by _id,
    // which also drops the stale paginated copy of a boosted ad.
    useEffect(() => {
        if (ads && ads.length > 0) {
            const fresh = freshAdsRef.current.get(cacheKey) ?? [];
            const mergedAds = mergeAheadOfQuery(fresh, ads);
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
        boostedAdKeys,
        clearBoostedAdKeys,
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
