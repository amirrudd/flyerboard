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
        vi.mocked(useQuery).mockImplementation((query: any) => {
            // Since we can't easily import the api object, we'll just return a "happy path" object
            // that satisfies all queries.
            // Or checking if query is a function or object and has a name property?
            // Convex query objects usually have a name or similar.
            // But simpler: just return a merged object or check if we can differentiate.
            // If we return the SAME object for all queries, it might work if the component handles extra fields gracefully.

            // Let's try to return a user object if it looks like auth, or empty array if it looks like list.
            // But we don't know which is which easily.
            // However, `useQuery` is called with `api.auth.loggedInUser`, `api.posts.getUserAds`, etc.
            // These are distinct objects.
            // In the test environment, they are just objects.

            // Let's just return a "User" object for the first call (usually user), and [] for others?
            // No, hooks order matters.
            // 1. loggedInUser
            // 2. getUserAds
            // 3. getUserStats
            // 4. getSellerChats
            // 5. getBuyerChats
            // 6. getSavedAds
            // 7. getArchivedChats

            // We can use mockReturnValueOnce!
            return null;
        });

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

        expect(screen.getByText('No ads yet')).toBeInTheDocument();
        expect(screen.getByText('Post Your First Ad')).toBeInTheDocument();
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

        const postButton = screen.getByText('Post New Ad');
        fireEvent.click(postButton);

        expect(mockOnPostAd).toHaveBeenCalled();
    });
});
