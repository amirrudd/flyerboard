import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Circle } from 'react-leaflet';
import { MapPin } from '@phosphor-icons/react';
import 'leaflet/dist/leaflet.css';

interface LocationMapProps {
    location: string;
    className?: string;
}

interface Coordinates {
    lat: number;
    lng: number;
}

// Basemap tile styles (all free, no API key). Swap TILE_STYLE below to change the look.
// CARTO usage requires the attribution string kept on the TileLayer.
const TILE_STYLES = {
    // Warm, muted, low-clutter — designed feel. Recommended default.
    voyager: {
        url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    },
    // Near-monochrome light grey, faint labels — very minimal.
    positron: {
        url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
        attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    },
    // Same as positron but no text labels — cleanest, the circle dominates.
    positronNoLabels: {
        url: 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png',
        attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    },
    // Dark charcoal minimal.
    darkMatter: {
        url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    },
    // Fully detailed original OpenStreetMap tiles.
    osm: {
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
} as const;

const TILE_STYLE = TILE_STYLES.positron;

// Resolve the brand primary color from the CSS variable, with a safe fallback.
function usePrimaryColor(): string {
    return useMemo(() => {
        if (typeof document === 'undefined') return '#9e1b1e';
        const primaryHsl = getComputedStyle(document.documentElement)
            .getPropertyValue('--primary')
            .trim();
        return primaryHsl ? `hsl(${primaryHsl})` : '#9e1b1e';
    }, []);
}

export function LocationMap({ location, className = '' }: LocationMapProps) {
    const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const primaryColor = usePrimaryColor();

    useEffect(() => {
        const geocodeLocation = async () => {
            setLoading(true);
            setError(null);

            try {
                // Use Nominatim API for free geocoding
                const response = await fetch(
                    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}&limit=1`,
                    {
                        headers: {
                            'User-Agent': 'FlyerBoard/1.0', // Nominatim requires a User-Agent
                        },
                    }
                );

                if (!response.ok) {
                    throw new Error('Failed to geocode location');
                }

                const data = await response.json();

                if (data.length === 0) {
                    throw new Error('Location not found');
                }

                const { lat, lon } = data[0];
                setCoordinates({
                    lat: parseFloat(lat),
                    lng: parseFloat(lon),
                });
            } catch (err) {
                console.error('Geocoding error:', err);
                setError(err instanceof Error ? err.message : 'Failed to load map');
            } finally {
                setLoading(false);
            }
        };

        if (location) {
            void geocodeLocation();
        }
    }, [location]);

    if (loading) {
        return (
            <div className={`h-64 bg-muted rounded-lg flex items-center justify-center ${className}`}>
                <div className="text-center text-muted-foreground">
                    <div className="w-12 h-12 mx-auto mb-2 border-4 border-muted border-t-primary rounded-full animate-spin"></div>
                    <p className="text-sm">Loading map...</p>
                </div>
            </div>
        );
    }

    if (error || !coordinates) {
        return (
            <div className={`h-64 bg-muted rounded-lg flex items-center justify-center ${className}`}>
                <div className="text-center text-muted-foreground">
                    <MapPin className="w-12 h-12 mx-auto mb-2" />
                    <p className="text-sm">Unable to load map for this location</p>
                    {error && <p className="text-xs mt-1 text-muted-foreground">{error}</p>}
                </div>
            </div>
        );
    }

    const center: [number, number] = [coordinates.lat, coordinates.lng];

    return (
        <div className={`h-64 rounded-lg overflow-hidden ${className}`}>
            <MapContainer
                // Remount when the geocoded location changes so the view recenters.
                key={`${coordinates.lat},${coordinates.lng}`}
                center={center}
                zoom={13}
                className="h-full w-full"
                // Approximate-location preview: no panning/scroll-zoom, zoom buttons only.
                dragging={false}
                scrollWheelZoom={false}
                doubleClickZoom={false}
                zoomControl={true}
                attributionControl={true}
            >
                <TileLayer
                    attribution={TILE_STYLE.attribution}
                    url={TILE_STYLE.url}
                />
                {/* Circle overlay to show approximate location (1km radius) */}
                <Circle
                    center={center}
                    radius={1000}
                    pathOptions={{
                        color: primaryColor,
                        opacity: 0.8,
                        weight: 2,
                        fillColor: primaryColor,
                        fillOpacity: 0.2,
                    }}
                />
            </MapContainer>
        </div>
    );
}
