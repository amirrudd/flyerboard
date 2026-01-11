import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UserDashboard } from './UserDashboard';
import { useQuery } from 'convex/react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';

// Mock Descope SDK
const mockUseSession = vi.fn();
const mockUseUser = vi.fn();
vi.mock('@descope/react-sdk', () => ({
    useSession: () => mockUseSession(),
    useUser: () => mockUseUser(),
}));

// Mock convex hooks
vi.mock('convex/react', () => ({
    useQuery: vi.fn(),
    useMutation: vi.fn(() => vi.fn()),
    useAction: vi.fn(),
}));

// Mock child components
vi.mock('../layout/Header', () => ({
    Header: () => <div>Header</div>,
}));
vi.mock('../ads/AdDetail', () => ({
    AdDetail: () => <div>AdDetail</div>,
}));
vi.mock('../ads/AdMessages', () => ({
    AdMessages: () => <div>AdMessages</div>,
}));

describe('UserDashboard', () => {
    const mockOnBack = vi.fn();
    const mockOnPostAd = vi.fn();
    const mockOnEditAd = vi.fn();

    const renderDashboard = () => {
        return render(
            <BrowserRouter>
                <UserDashboard
                    onBack={mockOnBack}
                    onPostAd={mockOnPostAd}
                    onEditAd={mockOnEditAd}
                />
            </BrowserRouter>
        );
    };

    beforeEach(() => {
        vi.clearAllMocks();
        // Default to authenticated for most tests
        mockUseSession.mockReturnValue({ isAuthenticated: true });
        mockUseUser.mockReturnValue({
            user: {
                name: 'Descope User',
                email: 'test@descope.com',
                picture: 'https://example.com/pic.jpg'
            }
        });
    });

    it('should show sign in message when user is not logged in', () => {
        mockUseSession.mockReturnValue({ isAuthenticated: false });

        renderDashboard();

        expect(screen.getByText('Please sign in')).toBeInTheDocument();
    });

    it('should render dashboard tabs when user is logged in', () => {
        mockUseSession.mockReturnValue({ isAuthenticated: true });

        // Order: getCurrentUserWithStats, getUserAds, sellerChats(skip), buyerChats(skip), savedAds(skip), archivedChats(skip), chatMessages(skip), unreadCounts(skip)
        vi.mocked(useQuery)
            .mockReturnValueOnce({  // getCurrentUserWithStats (combined)
                user: { _id: 'user1', name: 'Test User' },
                stats: { totalAds: 0, totalViews: 0 }
            })
            .mockReturnValueOnce([]) // getUserAds (ads tab is active by default)
            .mockReturnValueOnce(undefined) // sellerChats (skipped - not chats tab)
            .mockReturnValueOnce(undefined) // buyerChats (skipped - not chats tab)
            .mockReturnValueOnce(undefined) // savedAds (skipped - not saved tab)
            .mockReturnValueOnce(undefined) // archivedChats (skipped)
            .mockReturnValueOnce(undefined) // chatMessages (skipped)
            .mockReturnValueOnce(undefined); // unreadCounts (skipped)

        renderDashboard();

        expect(screen.getAllByText('My Flyers')[0]).toBeInTheDocument();
        expect(screen.getByText('Messages')).toBeInTheDocument();
        expect(screen.getAllByText('Saved Flyers')[0]).toBeInTheDocument();
        expect(screen.getByText('Profile')).toBeInTheDocument();
    });

    it('should show "No ads yet" when user has no ads', async () => {
        mockUseSession.mockReturnValue({ isAuthenticated: true });

        // Provide enough mock return values for multiple render cycles
        const userWithStats = {
            user: { _id: 'user1', name: 'Test User', email: 'test@test.com' },
            stats: { totalAds: 0, totalViews: 0, averageRating: 0, ratingCount: 0 }
        };

        vi.mocked(useQuery)
            // First render cycle - order: getCurrentUserWithStats, getUserAds, then skipped queries
            .mockReturnValueOnce(userWithStats)  // getCurrentUserWithStats
            .mockReturnValueOnce([])    // getUserAds (ads tab active)
            .mockReturnValueOnce(undefined) // sellerChats (skipped)
            .mockReturnValueOnce(undefined) // buyerChats (skipped)
            .mockReturnValueOnce(undefined) // savedAds (skipped)
            .mockReturnValueOnce(undefined) // archivedChats (skipped)
            .mockReturnValueOnce(undefined) // getChatMessages (skipped)
            .mockReturnValueOnce(undefined) // getUnreadCounts (skipped)
            // Second render cycle (React may re-render)
            .mockReturnValueOnce(userWithStats)
            .mockReturnValueOnce([])
            .mockReturnValueOnce(undefined)
            .mockReturnValueOnce(undefined)
            .mockReturnValueOnce(undefined)
            .mockReturnValueOnce(undefined)
            .mockReturnValueOnce(undefined)
            .mockReturnValueOnce(undefined)
            // Default for any remaining calls
            .mockReturnValue(undefined);

        renderDashboard();

        await waitFor(() => {
            expect(screen.getByText('No Flyers Yet')).toBeInTheDocument();
        }, { timeout: 1000 });
        expect(screen.getByText('Pin Your First Flyer')).toBeInTheDocument();
    });

    it('should call onPostAd when button is clicked', () => {
        mockUseSession.mockReturnValue({ isAuthenticated: true });

        // Order: getCurrentUserWithStats, getUserAds, then skipped queries
        vi.mocked(useQuery)
            .mockReturnValueOnce({  // getCurrentUserWithStats
                user: { _id: 'user1', name: 'Test User' },
                stats: { totalAds: 0, totalViews: 0 }
            })
            .mockReturnValueOnce([]) // getUserAds
            .mockReturnValueOnce(undefined) // sellerChats (skipped)
            .mockReturnValueOnce(undefined) // buyerChats (skipped)
            .mockReturnValueOnce(undefined) // savedAds (skipped)
            .mockReturnValueOnce(undefined) // archivedChats (skipped)
            .mockReturnValueOnce(undefined) // chatMessages (skipped)
            .mockReturnValueOnce(undefined); // unreadCounts (skipped)

        renderDashboard();

        const postButton = screen.getByText('Pin Next Flyer');
        fireEvent.click(postButton);

        expect(mockOnPostAd).toHaveBeenCalled();
    });

    it('should redirect to ads tab when accessing invalid tabs on mobile', async () => {
        mockUseSession.mockReturnValue({ isAuthenticated: true });

        // Mock window.matchMedia to simulate mobile viewport
        Object.defineProperty(window, 'matchMedia', {
            writable: true,
            value: vi.fn().mockImplementation(query => ({
                matches: query === '(max-width: 768px)', // Mobile viewport
                media: query,
                onchange: null,
                addListener: vi.fn(),
                removeListener: vi.fn(),
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
                dispatchEvent: vi.fn(),
            })),
        });

        const userWithStats = {
            user: { _id: 'user1', name: 'Test User', email: 'test@test.com' },
            stats: { totalAds: 0, totalViews: 0, averageRating: 0, ratingCount: 0 }
        };

        // Order: getCurrentUserWithStats, getUserAds, then skipped queries
        vi.mocked(useQuery)
            .mockReturnValueOnce(userWithStats)  // getCurrentUserWithStats
            .mockReturnValueOnce([])    // getUserAds (will be fetched after redirect to ads tab)
            .mockReturnValueOnce(undefined) // sellerChats (skipped)
            .mockReturnValueOnce(undefined) // buyerChats (skipped)
            .mockReturnValueOnce(undefined) // savedAds (skipped)
            .mockReturnValueOnce(undefined) // archivedChats (skipped)
            .mockReturnValueOnce(undefined) // chatMessages (skipped)
            .mockReturnValueOnce(undefined) // unreadCounts (skipped)
            .mockReturnValue(undefined);

        // Render with archived tab in URL
        const { container } = render(
            <MemoryRouter initialEntries={['/dashboard?tab=archived']}>
                <UserDashboard
                    onBack={mockOnBack}
                    onPostAd={mockOnPostAd}
                    onEditAd={mockOnEditAd}
                />
            </MemoryRouter>
        );

        // Should redirect to ads tab on mobile
        await waitFor(() => {
            const url = new URL(window.location.href);
            expect(url.searchParams.get('tab')).not.toBe('archived');
        }, { timeout: 1000 });
    });
});
