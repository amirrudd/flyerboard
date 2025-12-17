import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UserDashboard } from './UserDashboard';
import { useQuery } from 'convex/react';
import { BrowserRouter } from 'react-router-dom';

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

        vi.mocked(useQuery)
            .mockReturnValueOnce({ _id: 'user1', name: 'Test User' }) // getCurrentUser
            .mockReturnValueOnce([]) // getUserAds
            .mockReturnValueOnce({ totalAds: 0, totalViews: 0 }) // getUserStats
            .mockReturnValueOnce([]) // getSellerChats
            .mockReturnValueOnce([]) // getBuyerChats
            .mockReturnValueOnce([]) // getSavedAds
            .mockReturnValueOnce([]); // getArchivedChats

        renderDashboard();

        expect(screen.getAllByText('My Flyers')[0]).toBeInTheDocument();
        expect(screen.getByText('Messages')).toBeInTheDocument();
        expect(screen.getAllByText('Saved Flyers')[0]).toBeInTheDocument();
        expect(screen.getByText('Profile')).toBeInTheDocument();
    });

    it('should show "No ads yet" when user has no ads', async () => {
        mockUseSession.mockReturnValue({ isAuthenticated: true });

        // Provide enough mock return values for multiple render cycles
        const user = { _id: 'user1', name: 'Test User', email: 'test@test.com' };
        const stats = { totalAds: 0, totalViews: 0, averageRating: 0, ratingCount: 0 };

        vi.mocked(useQuery)
            // First render cycle
            .mockReturnValueOnce(user)  // getCurrentUser
            .mockReturnValueOnce([])    // getUserAds
            .mockReturnValueOnce(stats) // getUserStats
            .mockReturnValueOnce([])    // getSellerChats
            .mockReturnValueOnce([])    // getBuyerChats
            .mockReturnValueOnce([])    // getSavedAds
            .mockReturnValueOnce(undefined) // getArchivedChats (skipped)
            .mockReturnValueOnce(undefined) // getChatMessages (skipped)
            .mockReturnValueOnce({})    // getUnreadCounts
            // Second render cycle (React may re-render)
            .mockReturnValueOnce(user)
            .mockReturnValueOnce([])
            .mockReturnValueOnce(stats)
            .mockReturnValueOnce([])
            .mockReturnValueOnce([])
            .mockReturnValueOnce([])
            .mockReturnValueOnce(undefined)
            .mockReturnValueOnce(undefined)
            .mockReturnValueOnce({})
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

        vi.mocked(useQuery)
            .mockReturnValueOnce({ _id: 'user1', name: 'Test User' }) // getCurrentUser
            .mockReturnValueOnce([]) // getUserAds
            .mockReturnValueOnce({ totalAds: 0, totalViews: 0 }) // getUserStats
            .mockReturnValueOnce([]) // getSellerChats
            .mockReturnValueOnce([]) // getBuyerChats
            .mockReturnValueOnce([]) // getSavedAds
            .mockReturnValueOnce([]); // getArchivedChats

        renderDashboard();

        const postButton = screen.getByText('Pin Next Flyer');
        fireEvent.click(postButton);

        expect(mockOnPostAd).toHaveBeenCalled();
    });
});
