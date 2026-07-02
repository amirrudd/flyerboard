import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AdDetailPage } from './AdDetailPage';

// Mock react-router-dom. useOutletContext supplies Layout's shared auth-modal
// setter (the page no longer owns a modal of its own — see Layout.tsx).
const mockNavigate = vi.fn();
const mockSetShowAuthModal = vi.fn();
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate,
        useParams: () => ({ id: 'test-ad-id' }),
        useLocation: () => ({ state: null, pathname: '/ads/test-ad-id' }),
        useOutletContext: () => ({ setShowAuthModal: mockSetShowAuthModal }),
    };
});

// Mock AdDetail component
vi.mock('../features/ads/AdDetail', () => ({
    AdDetail: ({ onBack, onShowAuth, adId }: any) => (
        <div data-testid="ad-detail">
            <button onClick={onBack} data-testid="back-button">
                Back to flyers
            </button>
            <button onClick={onBack} data-testid="header-title">
                FlyerBoard
            </button>
            <button onClick={onShowAuth} data-testid="auth-button">
                Sign In
            </button>
            <div data-testid="ad-id">{adId}</div>
        </div>
    ),
}));

describe('AdDetailPage - Navigation', () => {
    beforeEach(() => {
        mockNavigate.mockClear();
        mockSetShowAuthModal.mockClear();
    });

    it('should navigate back when back button is clicked', async () => {
        render(
            <BrowserRouter>
                <AdDetailPage />
            </BrowserRouter>
        );

        // Find and click the back button
        const backButton = screen.getByTestId('back-button');
        fireEvent.click(backButton);

        // Verify navigate was called with -1 (go back)
        expect(mockNavigate).toHaveBeenCalledWith(-1);
    });

    it('should navigate back when FlyerBoard header is clicked', async () => {
        render(
            <BrowserRouter>
                <AdDetailPage />
            </BrowserRouter>
        );

        // Find and click the header title
        const headerTitle = screen.getByTestId('header-title');
        fireEvent.click(headerTitle);

        // Verify navigate was called with -1
        expect(mockNavigate).toHaveBeenCalledWith(-1);
    });

    it('should pass the correct ad ID to AdDetail component', () => {
        render(
            <BrowserRouter>
                <AdDetailPage />
            </BrowserRouter>
        );

        // Verify the ad ID is passed correctly
        expect(screen.getByTestId('ad-id')).toHaveTextContent('test-ad-id');
    });

    it('should open the shared Layout auth modal when sign in is triggered', () => {
        render(
            <BrowserRouter>
                <AdDetailPage />
            </BrowserRouter>
        );

        // The page no longer owns a modal — it delegates to Layout's via outlet context
        expect(mockSetShowAuthModal).not.toHaveBeenCalled();

        // Click the auth button
        const authButton = screen.getByTestId('auth-button');
        fireEvent.click(authButton);

        expect(mockSetShowAuthModal).toHaveBeenCalledWith(true);
    });
});
