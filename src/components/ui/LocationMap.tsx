import { useEffect, useState, useRef } from 'react';
import { APIProvider, Map, useMap } from '@vis.gl/react-google-maps';
import { AlertTriangle, MapPin } from 'lucide-react';

interface LocationMapProps {
    location: string;
    className?: string;
}

interface Coordinates {
    lat: number;
    lng: number;
}

// Component to handle the circle overlay
function CircleOverlay({ center, radius }: { center: Coordinates; radius: number }) {
    const map = useMap();
    const circleRef = useRef<google.maps.Circle | null>(null);

    useEffect(() => {
        if (!map) return;

        // Create circle if it doesn't exist
        if (!circleRef.current) {
            circleRef.current = new google.maps.Circle({
                map,
                center,
                radius: 1000, // 1km radius for approximate location
                strokeColor: '#f97316',
                strokeOpacity: 0.8,
                strokeWeight: 2,
                fillColor: '#f97316',
                fillOpacity: 0.2,
            });
        } else {
            // Update existing circle
            circleRef.current.setCenter(center);
            circleRef.current.setRadius(1000); // Update to 1km radius
        }

        // Cleanup on unmount
        return () => {
            if (circleRef.current) {
                circleRef.current.setMap(null);
            }
        };
    }, [map, center, radius]);

    return null;
}

export function LocationMap({ location, className = '' }: LocationMapProps) {
    const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

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
            geocodeLocation();
        }
    }, [location]);

    if (!apiKey) {
        return (
            <div className={`h-64 bg-neutral-100 rounded-lg flex items-center justify-center ${className}`}>
                <div className="text-center text-neutral-500">
                    <AlertTriangle className="w-12 h-12 mx-auto mb-2" />
                    <p className="text-sm">Map configuration missing</p>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className={`h-64 bg-neutral-100 rounded-lg flex items-center justify-center ${className}`}>
                <div className="text-center text-neutral-500">
                    <div className="w-12 h-12 mx-auto mb-2 border-4 border-neutral-300 border-t-primary-600 rounded-full animate-spin"></div>
                    <p className="text-sm">Loading map...</p>
                </div>
            </div>
        );
    }

    if (error || !coordinates) {
        return (
            <div className={`h-64 bg-neutral-100 rounded-lg flex items-center justify-center ${className}`}>
                <div className="text-center text-neutral-500">
                    <MapPin className="w-12 h-12 mx-auto mb-2" />
                    <p className="text-sm">Unable to load map for this location</p>
                    {error && <p className="text-xs mt-1 text-neutral-400">{error}</p>}
                </div>
            </div>
        );
    }

    return (
        <div className={`h-64 rounded-lg overflow-hidden ${className}`}>
            <APIProvider apiKey={apiKey}>
                <Map
                    defaultCenter={coordinates}
                    defaultZoom={13}
                    gestureHandling="greedy"
                    disableDefaultUI={true}
                    zoomControl={true}
                    mapId="flyerboard-location-map"
                >
                    {/* Circle overlay to show approximate location (1km radius) */}
                    <CircleOverlay center={coordinates} radius={1000} />
                </Map>
            </APIProvider>
        </div>
    );
}
