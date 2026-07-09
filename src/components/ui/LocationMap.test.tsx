import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { LocationMap } from './LocationMap';

// Mock react-leaflet — the real components need a DOM map instance jsdom can't provide.
// Forward the load-bearing props (tile url/attribution, circle color) onto the DOM so
// tests can assert the migration's actual config, not just "a div rendered".
vi.mock('react-leaflet', () => ({
    MapContainer: ({ children }: { children: React.ReactNode }) => (
        <div data-testid="leaflet-map">{children}</div>
    ),
    TileLayer: ({ url, attribution }: { url: string; attribution: string }) => (
        <div data-testid="tile-layer" data-url={url} data-attribution={attribution} />
    ),
    Circle: ({ pathOptions }: { pathOptions?: { color?: string } }) => (
        <div data-testid="location-circle" data-color={pathOptions?.color} />
    ),
}));

// Leaflet's CSS import is a no-op under Vitest, but stub it to be safe.
vi.mock('leaflet/dist/leaflet.css', () => ({}));

// Mock fetch for Nominatim API
global.fetch = vi.fn();

describe('LocationMap', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should show loading state initially', () => {
        (global.fetch as any).mockImplementation(() => new Promise(() => { })); // Never resolves

        render(<LocationMap location="Sydney, CBD" />);

        expect(screen.getByText('Loading map...')).toBeInTheDocument();
    });

    it('should render map with circle overlay after successful geocoding', async () => {
        const mockGeocodingResponse = [
            {
                lat: '-33.8688',
                lon: '151.2093',
                display_name: 'Sydney CBD, New South Wales, Australia',
            },
        ];

        (global.fetch as any).mockResolvedValueOnce({
            ok: true,
            json: async () => mockGeocodingResponse,
        });

        render(<LocationMap location="Sydney, CBD" />);

        await waitFor(() => {
            expect(screen.getByTestId('leaflet-map')).toBeInTheDocument();
        });

        // Assert the migration's actual config reaches the map, not just that it rendered:
        // the CARTO Positron tile URL, its required attribution, and a brand-colored circle.
        const tile = screen.getByTestId('tile-layer');
        expect(tile.getAttribute('data-url')).toContain('basemaps.cartocdn.com/light_all');
        expect(tile.getAttribute('data-attribution')).toContain('CARTO');
        expect(screen.getByTestId('location-circle').getAttribute('data-color')).toBeTruthy();
    });

    it('should show error state when geocoding fails', async () => {
        (global.fetch as any).mockResolvedValueOnce({
            ok: false,
            status: 500,
        });

        render(<LocationMap location="Invalid Location" />);

        await waitFor(() => {
            expect(screen.getByText('Unable to load map for this location')).toBeInTheDocument();
        });
    });

    it('should show error state when location is not found', async () => {
        (global.fetch as any).mockResolvedValueOnce({
            ok: true,
            json: async () => [], // Empty results
        });

        render(<LocationMap location="NonexistentPlace123" />);

        await waitFor(() => {
            expect(screen.getByText('Unable to load map for this location')).toBeInTheDocument();
        });
    });

    it('should call Nominatim API with correct parameters', async () => {
        const mockGeocodingResponse = [
            {
                lat: '-37.8136',
                lon: '144.9631',
                display_name: 'Melbourne CBD, Victoria, Australia',
            },
        ];

        (global.fetch as any).mockResolvedValueOnce({
            ok: true,
            json: async () => mockGeocodingResponse,
        });

        render(<LocationMap location="Melbourne, CBD" />);

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('https://nominatim.openstreetmap.org/search'),
                expect.objectContaining({
                    headers: {
                        'User-Agent': 'FlyerBoard/1.0',
                    },
                })
            );
        });

        // Verify the URL contains the encoded location
        const fetchCall = (global.fetch as any).mock.calls[0][0];
        expect(fetchCall).toContain(encodeURIComponent('Melbourne, CBD'));
        expect(fetchCall).toContain('format=json');
        expect(fetchCall).toContain('limit=1');
    });

    it('should apply custom className', () => {
        (global.fetch as any).mockImplementation(() => new Promise(() => { }));

        const { container } = render(<LocationMap location="Sydney, CBD" className="custom-class" />);

        const mapContainer = container.querySelector('.custom-class');
        expect(mapContainer).toBeInTheDocument();
    });
});
