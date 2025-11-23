import { toast } from "sonner";

export interface LocationData {
    id: number;
    postcode: string;
    locality: string;
    state: string;
    long: number;
    lat: number;
}

let locationsCache: LocationData[] | null = null;
let fetchPromise: Promise<LocationData[]> | null = null;

export const fetchLocations = async (): Promise<LocationData[]> => {
    if (locationsCache) return locationsCache;
    if (fetchPromise) return fetchPromise;

    fetchPromise = fetch("/australian-postcodes.json")
        .then(async (res) => {
            if (!res.ok) throw new Error("Failed to load location data");
            const data = await res.json();
            locationsCache = data;
            return data;
        })
        .catch((err) => {
            console.error("Error loading locations:", err);
            toast.error("Failed to load location data. Please try again.");
            return [];
        });

    return fetchPromise;
};

export const searchLocations = async (query: string): Promise<LocationData[]> => {
    if (!query || query.length < 2) return [];

    const locations = await fetchLocations();
    const lowerQuery = query.toLowerCase();

    // Filter and limit results to 50 to avoid performance issues
    return locations
        .filter((loc) =>
            loc.locality.toLowerCase().includes(lowerQuery) ||
            loc.postcode.startsWith(lowerQuery)
        )
        .slice(0, 50);
};

export const formatLocation = (loc: LocationData) => {
    return `${loc.locality}, ${loc.state} ${loc.postcode}`;
};
