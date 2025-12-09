import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

        expect(screen.getByText('My Ads')).toBeInTheDocument();
        expect(screen.getByText('Messages')).toBeInTheDocument();
        expect(screen.getByText('Saved Ads')).toBeInTheDocument();
        expect(screen.getByText('Profile')).toBeInTheDocument();
    });

    it('should show "No ads yet" when user has no ads', () => {
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

        expect(screen.getByText('No Flyers Yet')).toBeInTheDocument();
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
