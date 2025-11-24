import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UserDashboard } from './UserDashboard';
import { useQuery } from 'convex/react';
import { BrowserRouter } from 'react-router-dom';

// Mock convex hooks
vi.mock('convex/react', () => ({
    useQuery: vi.fn(),
    useMutation: vi.fn(() => vi.fn()),
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
    });

    it('should show sign in message when user is not logged in', () => {
        vi.mocked(useQuery).mockReturnValue(null); // No user

        renderDashboard();

        expect(screen.getByText('Please sign in')).toBeInTheDocument();
    });

    it('should render dashboard tabs when user is logged in', () => {
        vi.mocked(useQuery)
            .mockReturnValueOnce({ name: 'Test User', email: 'test@example.com' }) // loggedInUser
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
        vi.mocked(useQuery)
            .mockReturnValueOnce({ name: 'Test User' }) // loggedInUser
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
        vi.mocked(useQuery)
            .mockReturnValueOnce({ name: 'Test User' }) // loggedInUser
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
