import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { useQuery, useMutation, usePaginatedQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import Cookies from "js-cookie";
import { toast } from "sonner";

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

    // --- Data Fetching ---
    const categories = useQuery(api.categories.getCategories);

    // Stable pagination: freeze the timestamp when the component mounts (or when filters change)
    const [initialLoadTimestamp, setInitialLoadTimestamp] = useState(Date.now());

    // Reset timestamp when filters change to "refresh" the feed
    useEffect(() => {
        setInitialLoadTimestamp(Date.now());
    }, [selectedCategory, searchQuery, selectedLocation]);

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

    const clearAndCreateSampleData = useMutation(api.sampleData.clearAndCreateSampleData);

    // --- Effects ---

    // Handle responsive sidebar behavior
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth < 768) {
                setSidebarCollapsed(true);
            }
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Handle location change and save to cookies
    const handleSetSelectedLocation = useCallback((location: string) => {
        setSelectedLocation(location);
        Cookies.set("selectedLocation", location, { expires: 365 });
    }, []);

    // Initialize sample data if needed
    useEffect(() => {
        if (categories !== undefined && categories.length === 0) {
            clearAndCreateSampleData().then(() => {
                toast.success("Sample data created");
            }).catch((error) => {
                console.error("Error creating sample data:", error);
            });
        }
    }, [categories, clearAndCreateSampleData]);

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
        ads,
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
