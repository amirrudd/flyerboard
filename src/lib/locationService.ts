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
let loadFailed = false;

/** True once the dataset fetch has failed (it caches the failure for the session). */
export const locationsUnavailable = () => loadFailed;

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
            loadFailed = true;
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

/**
 * Does this string look like `formatLocation()` output — the canonical form
 * every location filter compares on? Legacy rows hold free text a seller typed
 * ("Richmond, VIC"), which matches nothing; those must be re-picked rather than
 * silently accepted as a confirmed choice.
 */
export const isCanonicalLocation = (location: string) =>
    /,\s*[A-Z]{2,3}\s+\d{4}$/.test(location.trim());

/**
 * The prose form of a stored location. `formatLocation()` is the canonical
 * string every filter compares on ("RICHMOND, VIC 3121"), but the postcode is
 * noise in a card subtitle or a printed flyer, so display drops it:
 * "RICHMOND, VIC". Never store this — it's a view of the canonical value.
 * A location with no trailing postcode (older free-text rows) passes through.
 */
export const displayLocation = (location: string) =>
    location.replace(/\s+\d{4}\s*$/, "").trim();
