import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Header } from './Header';
import { BrowserRouter } from 'react-router-dom';
import { searchLocations } from '../../lib/locationService';

// Mock child components to simplify testing
vi.mock('./HeaderRightActions', () => ({
    HeaderRightActions: () => <div data-testid="header-right-actions">Actions</div>,
}));

vi.mock('../auth/SignOutButton', () => ({
    SignOutButton: () => <button>Sign Out</button>,
}));

// Mock location service
vi.mock('../../lib/locationService', () => ({
    searchLocations: vi.fn().mockResolvedValue([]),
    formatLocation: vi.fn((loc) => `${loc.locality}, ${loc.state} ${loc.postcode}`),
    fetchLocations: vi.fn().mockResolvedValue([]),
    displayLocation: vi.fn((location: string) => location),
    // Both are used by LocationPicker, which the header now renders in place of
    // its own hand-rolled suburb box.
    locationsUnavailable: vi.fn(() => false),
    isCanonicalLocation: vi.fn((location: string) => /,\s*[A-Z]{2,3}\s+\d{4}$/.test(location.trim())),
    // The REAL mapping (re-exported from convex/lib/location) — the header's job
    // is to hand the picked row on, and a stub would hide it dropping fields.
    toLocationMeta: (row?: { id: number; lat?: number; long?: number; sa4?: string }) =>
        row
            ? {
                  localityId: row.id,
                  ...(row.lat && row.long ? { latitude: row.lat, longitude: row.long } : {}),
                  sa4Code: row.sa4,
                  locationSource: "picked" as const,
              }
            : { locationSource: "unresolved" as const },
}));

// Mock performance utils (debounce)
vi.mock('../../lib/performanceUtils', () => ({
    debounce: (fn: (...args: unknown[]) => unknown) => fn,
}));

// Mock Descope useSession hook
vi.mock('@descope/react-sdk', () => ({
    useSession: () => ({
        isAuthenticated: false,
        isSessionLoading: false,
        sessionToken: null,
    }),
}));

describe('Header', () => {
    const renderHeader = (props = {}) => {
        return render(
            <BrowserRouter>
                <Header {...props} />
            </BrowserRouter>
        );
    };

    it('should render logo and search bar', () => {
        renderHeader();
        // Logo appears in both desktop and mobile views
        const logos = screen.getAllByText('FlyerBoard');
        expect(logos.length).toBeGreaterThan(0);

        // Search bar might also appear multiple times
        const searchInputs = screen.getAllByPlaceholderText('Search in flyers...');
        expect(searchInputs.length).toBeGreaterThan(0);
    });

    it('should render right actions', () => {
        renderHeader();
        expect(screen.getByTestId('header-right-actions')).toBeInTheDocument();
    });

    it('should call setSearchQuery when typing in search bar', () => {
        const setSearchQuery = vi.fn();
        renderHeader({ setSearchQuery });

        // Target the desktop search input (or the first one found)
        const inputs = screen.getAllByPlaceholderText('Search in flyers...');
        fireEvent.change(inputs[0], { target: { value: 'test' } });

        expect(setSearchQuery).toHaveBeenCalledWith('test');
    });

    it('should toggle sidebar when menu button is clicked (mobile)', () => {
        // Resize window to mobile size
        window.innerWidth = 500;
        fireEvent(window, new Event('resize'));

        const setSidebarCollapsed = vi.fn();
        renderHeader({ setSidebarCollapsed, sidebarCollapsed: false });

        const menuButtons = screen.getAllByTitle(/menu/i);
        // Assuming the mobile one is visible or at least present
        fireEvent.click(menuButtons[0]);

        expect(setSidebarCollapsed).toHaveBeenCalled();
    });

    it('picks the suburb match whose postcode came back from geolocation', async () => {
        // RICHMOND exists in NSW, VIC and QLD, and the dataset lists NSW first —
        // only the postcode tells us which one the user is standing in.
        const richmonds = [
            { id: 1, postcode: '2753', locality: 'RICHMOND', state: 'NSW', long: 150.6, lat: -33.6 },
            { id: 2, postcode: '3121', locality: 'RICHMOND', state: 'VIC', long: 145.0, lat: -37.8 },
        ];
        vi.mocked(searchLocations).mockResolvedValue(richmonds);
        vi.stubGlobal('navigator', {
            ...navigator,
            geolocation: {
                getCurrentPosition: (success: PositionCallback) =>
                    success({ coords: { latitude: -37.82, longitude: 145.0 } } as GeolocationPosition),
            },
        });
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ address: { suburb: 'Richmond', postcode: '3121' } }),
        }));

        const setSelectedLocation = vi.fn();
        renderHeader({ setSelectedLocation });

        fireEvent.click(screen.getAllByText('All Locations')[0]);
        fireEvent.click(screen.getByText('Detect my location'));

        // The RECORD of the row detection matched travels with the string. It is
        // never re-derived from it later: two dataset rows can share one string
        // and sit 80 km apart (convex/lib/nearby.ts).
        await waitFor(() =>
            expect(setSelectedLocation).toHaveBeenCalledWith('RICHMOND, VIC 3121', {
                localityId: 2,
                latitude: -37.8,
                longitude: 145.0,
                sa4Code: undefined,
                locationSource: 'picked',
            })
        );

        vi.unstubAllGlobals();
    });
});
