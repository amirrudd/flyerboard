import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PostAdPage } from './PostAdPage';
import { MemoryRouter } from 'react-router-dom';

// Mock the PostAd component
vi.mock('../features/ads/PostAd', () => ({
    PostAd: ({ onBack, editingAd, origin }: any) => (
        <div data-testid="post-ad-component">
            <button onClick={onBack} data-testid="back-button">Back</button>
            <div data-testid="editing-ad">{editingAd ? 'Editing' : 'Creating'}</div>
            <div data-testid="origin">{origin}</div>
        </div>
    ),
}));

// Mock Descope so the route-guard's useSession() resolves authenticated.
const mockUseSession = vi.fn();
vi.mock('@descope/react-sdk', () => ({
    useSession: () => mockUseSession(),
}));

const mockNavigate = vi.fn();
const mockUseLocation = vi.fn();

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate,
        useLocation: () => mockUseLocation(),
    };
});

describe('PostAdPage - Navigation Tests', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseSession.mockReturnValue({ isAuthenticated: true, isSessionLoading: false });
    });

    it('should render PostAd component', () => {
        mockUseLocation.mockReturnValue({ state: {} });

        render(
            <MemoryRouter>
                <PostAdPage />
            </MemoryRouter>
        );

        expect(screen.getByTestId('post-ad-component')).toBeInTheDocument();
    });

    it('should navigate to home with forceRefresh when onBack is called from home', () => {
        mockUseLocation.mockReturnValue({
            state: { from: '/' },
        });

        render(
            <MemoryRouter>
                <PostAdPage />
            </MemoryRouter>
        );

        const backButton = screen.getByTestId('back-button');
        backButton.click();

        // Should navigate to home with forceRefresh flag to update ads list
        expect(mockNavigate).toHaveBeenCalledWith('/', { state: { forceRefresh: true } });
    });

    it('should navigate to dashboard when onBack is called from dashboard', () => {
        mockUseLocation.mockReturnValue({
            state: { from: '/dashboard' },
        });

        render(
            <MemoryRouter>
                <PostAdPage />
            </MemoryRouter>
        );

        const backButton = screen.getByTestId('back-button');
        backButton.click();

        expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });

    it('should navigate to home with forceRefresh when posting a new ad from ad detail page', () => {
        mockUseLocation.mockReturnValue({
            state: { from: '/ad/123' },
        });

        render(
            <MemoryRouter>
                <PostAdPage />
            </MemoryRouter>
        );

        const backButton = screen.getByTestId('back-button');
        backButton.click();

        // New posts (no editingAd) go home with forceRefresh so the new flyer is visible
        expect(mockNavigate).toHaveBeenCalledWith('/', { state: { forceRefresh: true } });
    });

    it('should navigate back to the ad detail page when editing from ad detail', () => {
        mockUseLocation.mockReturnValue({
            state: { editingAd: { _id: 'ad123', title: 'Test Ad' }, from: '/ad/ad123' },
        });

        render(
            <MemoryRouter>
                <PostAdPage />
            </MemoryRouter>
        );

        const backButton = screen.getByTestId('back-button');
        backButton.click();

        expect(mockNavigate).toHaveBeenCalledWith('/ad/ad123');
    });

    it('should navigate to home with forceRefresh when no from state is provided', () => {
        mockUseLocation.mockReturnValue({
            state: {},
        });

        render(
            <MemoryRouter>
                <PostAdPage />
            </MemoryRouter>
        );

        const backButton = screen.getByTestId('back-button');
        backButton.click();

        // Default behavior: navigate to home with forceRefresh
        expect(mockNavigate).toHaveBeenCalledWith('/', { state: { forceRefresh: true } });
    });

    it('should pass editingAd to PostAd component when provided', () => {
        const mockEditingAd = {
            _id: 'ad1',
            title: 'Test Ad',
            description: 'Test description',
            price: 100,
            location: 'Sydney',
            categoryId: 'cat1',
            images: ['image1.jpg'],
        };

        mockUseLocation.mockReturnValue({
            state: { editingAd: mockEditingAd, from: '/dashboard' },
        });

        render(
            <MemoryRouter>
                <PostAdPage />
            </MemoryRouter>
        );

        expect(screen.getByTestId('editing-ad')).toHaveTextContent('Editing');
    });

    it('should pass origin to PostAd component', () => {
        mockUseLocation.mockReturnValue({
            state: { from: '/dashboard' },
        });

        render(
            <MemoryRouter>
                <PostAdPage />
            </MemoryRouter>
        );

        expect(screen.getByTestId('origin')).toHaveTextContent('/dashboard');
    });

    it('should default origin to / when not provided', () => {
        mockUseLocation.mockReturnValue({
            state: {},
        });

        render(
            <MemoryRouter>
                <PostAdPage />
            </MemoryRouter>
        );

        expect(screen.getByTestId('origin')).toHaveTextContent('/');
    });
});

describe('PostAdPage - Route Guard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseLocation.mockReturnValue({ state: {} });
    });

    it('shows PageLoader and does not navigate while session is loading', () => {
        mockUseSession.mockReturnValue({ isAuthenticated: false, isSessionLoading: true });

        render(
            <MemoryRouter>
                <PostAdPage />
            </MemoryRouter>
        );

        expect(screen.getByText('Checking authentication...')).toBeInTheDocument();
        expect(screen.queryByTestId('post-ad-component')).not.toBeInTheDocument();
        expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('redirects unauthenticated users to home and does not render PostAd', () => {
        mockUseSession.mockReturnValue({ isAuthenticated: false, isSessionLoading: false });

        render(
            <MemoryRouter>
                <PostAdPage />
            </MemoryRouter>
        );

        expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
        expect(screen.queryByTestId('post-ad-component')).not.toBeInTheDocument();
    });

    it('renders PostAd when authenticated', () => {
        mockUseSession.mockReturnValue({ isAuthenticated: true, isSessionLoading: false });

        render(
            <MemoryRouter>
                <PostAdPage />
            </MemoryRouter>
        );

        expect(screen.getByTestId('post-ad-component')).toBeInTheDocument();
        expect(mockNavigate).not.toHaveBeenCalled();
    });
});

