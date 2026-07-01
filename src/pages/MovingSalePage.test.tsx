import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useQuery } from 'convex/react';
import { MovingSalePage } from './MovingSalePage';
import { MemoryRouter } from 'react-router-dom';

// Mock the heavy flow so we isolate the route guard.
vi.mock('../features/movingSale/MovingSaleFlow', () => ({
    MovingSaleFlow: ({ initialSaleId }: any) => (
        <div data-testid="moving-sale-flow">
            <div data-testid="initial-sale-id">{initialSaleId ?? 'none'}</div>
        </div>
    ),
}));

// Mock Descope so the route-guard's useSession() is controllable.
const mockUseSession = vi.fn();
vi.mock('@descope/react-sdk', () => ({
    useSession: () => mockUseSession(),
}));

// The movingSaleMode feature flag — default enabled unless a test overrides it.
vi.mock('convex/react', () => ({
    useQuery: vi.fn(),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});

describe('MovingSalePage - Route Guard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Feature enabled by default; individual tests override with mockReturnValueOnce.
        vi.mocked(useQuery).mockReturnValue(true);
    });

    it('shows PageLoader and does not navigate while session is loading', () => {
        mockUseSession.mockReturnValue({ isAuthenticated: false, isSessionLoading: true });

        render(
            <MemoryRouter>
                <MovingSalePage />
            </MemoryRouter>
        );

        expect(screen.getByText('Checking authentication...')).toBeInTheDocument();
        expect(screen.queryByTestId('moving-sale-flow')).not.toBeInTheDocument();
        expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('redirects unauthenticated users to home and does not render the flow', () => {
        mockUseSession.mockReturnValue({ isAuthenticated: false, isSessionLoading: false });

        render(
            <MemoryRouter>
                <MovingSalePage />
            </MemoryRouter>
        );

        expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
        expect(screen.queryByTestId('moving-sale-flow')).not.toBeInTheDocument();
    });

    it('renders MovingSaleFlow when authenticated and does not redirect', () => {
        mockUseSession.mockReturnValue({ isAuthenticated: true, isSessionLoading: false });

        render(
            <MemoryRouter>
                <MovingSalePage />
            </MemoryRouter>
        );

        expect(screen.getByTestId('moving-sale-flow')).toBeInTheDocument();
        expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('passes the ?sale= search param through to MovingSaleFlow as initialSaleId', () => {
        mockUseSession.mockReturnValue({ isAuthenticated: true, isSessionLoading: false });

        render(
            <MemoryRouter initialEntries={['/sell/moving-sale?sale=sale_123']}>
                <MovingSalePage />
            </MemoryRouter>
        );

        expect(screen.getByTestId('initial-sale-id')).toHaveTextContent('sale_123');
    });

    it('passes a null initialSaleId when no ?sale= param is present', () => {
        mockUseSession.mockReturnValue({ isAuthenticated: true, isSessionLoading: false });

        render(
            <MemoryRouter initialEntries={['/sell/moving-sale']}>
                <MovingSalePage />
            </MemoryRouter>
        );

        expect(screen.getByTestId('initial-sale-id')).toHaveTextContent('none');
    });

    it('redirects home when movingSaleMode is disabled, even for an authenticated user', () => {
        mockUseSession.mockReturnValue({ isAuthenticated: true, isSessionLoading: false });
        vi.mocked(useQuery).mockReturnValue(false);

        render(
            <MemoryRouter>
                <MovingSalePage />
            </MemoryRouter>
        );

        expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
        expect(screen.queryByTestId('moving-sale-flow')).not.toBeInTheDocument();
    });
});
