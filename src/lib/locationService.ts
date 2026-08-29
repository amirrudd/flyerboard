import { toast } from "sonner";

export interface LocationData {
    id: number;
    postcode: string;
    locality: string;
    state: string;
    long: number;
    lat: number;
    /** ABS Statistical Area Level 4 (ASGS 2021), e.g. "206". Absent on 7 of 18,559 rows. */
    sa4?: string;
}

/**
 * The part of a picked location that gets STORED alongside the formatted string.
 *
 * The formatted string ("RICHMOND, VIC 3121") stays the only thing any filter
 * compares on today — this record is the data the picker used to throw away, kept
 * so later work doesn't have to guess it back out of a name. Suburb names are not
 * unique (726 duplicated locality+state pairs in the dataset), so `localityId` is
 * the stable key, not the name.
 */
export interface LocationMeta {
    localityId?: number;
    latitude?: number;
    longitude?: number;
    sa4Code?: string;
    /** "picked" = came from the dataset. "unresolved" = free text, nothing behind it. */
    locationSource: "picked" | "unresolved";
}

/**
 * Build the stored record from a picked dataset row, or the honest empty record
 * when there is no row (the dataset failed to load and the seller typed a suburb).
 *
 * A missing coordinate is left MISSING. Six dataset rows carry (0, 0) as their own
 * "no coordinate" placeholder, and a wrong coordinate is indistinguishable from a
 * right one forever after — so a falsy lat/long writes no coordinate at all rather
 * than a point in the Gulf of Guinea.
 */
export const toLocationMeta = (loc?: LocationData): LocationMeta => {
    if (!loc) return { locationSource: "unresolved" };
    const hasPoint = Boolean(loc.lat && loc.long);
    return {
        localityId: loc.id,
        ...(hasPoint ? { latitude: loc.lat, longitude: loc.long } : {}),
        sa4Code: loc.sa4,
        locationSource: "picked",
    };
};

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
