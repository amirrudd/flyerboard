import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BottomNav } from './BottomNav';
import { BrowserRouter } from 'react-router-dom';
import { useQuery } from 'convex/react';

// Mock Descope SDK
const mockUseSession = vi.fn();
vi.mock('@descope/react-sdk', () => ({
    useSession: () => mockUseSession(),
}));

// Mock convex (getTotalUnreadCount badge query)
vi.mock('convex/react', () => ({
    useQuery: vi.fn(),
}));

// BottomNav gates the badge query on user sync
vi.mock('../../context/UserSyncContext', () => ({
    useUserSync: () => ({ isUserSynced: true }),
}));

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});

/** Simulate convex: "skip" → undefined, otherwise return `value`. */
function mockUnreadCount(value: number | undefined) {
    vi.mocked(useQuery).mockImplementation(((_query: any, args?: any) =>
        args === 'skip' ? undefined : value) as any);
}

describe('BottomNav', () => {
    const mockSetShowAuthModal = vi.fn();

    const renderBottomNav = () => {
        return render(
            <BrowserRouter>
                <BottomNav setShowAuthModal={mockSetShowAuthModal} />
            </BrowserRouter>
        );
    };

    beforeEach(() => {
        vi.clearAllMocks();
        // Default to not authenticated
        mockUseSession.mockReturnValue({ isAuthenticated: false, isSessionLoading: false });
        mockUnreadCount(0);
    });

    it('should render navigation items', () => {
        renderBottomNav();

        expect(screen.getByText('Home')).toBeInTheDocument();
        expect(screen.getByText('Saved')).toBeInTheDocument();
        expect(screen.getByText('PIN')).toBeInTheDocument();
        expect(screen.getByText('Messages')).toBeInTheDocument();
        expect(screen.getByText('Sign In')).toBeInTheDocument();
    });

    it('should show "Dashboard" when authenticated', () => {
        mockUseSession.mockReturnValue({ isAuthenticated: true });
        renderBottomNav();

        expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });

    it('should show "Sign In" when not authenticated', () => {
        mockUseSession.mockReturnValue({ isAuthenticated: false });
        renderBottomNav();

        expect(screen.getByText('Sign In')).toBeInTheDocument();
    });

    it('should open auth modal when clicking restricted link if not authenticated', () => {
        mockUseSession.mockReturnValue({ isAuthenticated: false });
        renderBottomNav();

        // Click on "Saved" which is restricted
        fireEvent.click(screen.getByText('Saved').closest('button')!);

        expect(mockSetShowAuthModal).toHaveBeenCalledWith(true);
        expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('should navigate when clicking restricted link if authenticated', () => {
        mockUseSession.mockReturnValue({ isAuthenticated: true });
        renderBottomNav();

        // Click on "Saved"
        fireEvent.click(screen.getByText('Saved').closest('button')!);

        expect(mockSetShowAuthModal).not.toHaveBeenCalled();
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard?tab=saved');
    });

    it('should open auth modal when clicking Post Flyer (PIN) if not authenticated', () => {
        mockUseSession.mockReturnValue({ isAuthenticated: false });
        renderBottomNav();

        // Click on "PIN"
        fireEvent.click(screen.getByText('PIN').closest('button')!);

        expect(mockSetShowAuthModal).toHaveBeenCalledWith(true);
        expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('should navigate when clicking Post Flyer (PIN) if authenticated', () => {
        mockUseSession.mockReturnValue({ isAuthenticated: true });
        renderBottomNav();

        // Click on "PIN"
        fireEvent.click(screen.getByText('PIN').closest('button')!);

        expect(mockSetShowAuthModal).not.toHaveBeenCalled();
        expect(mockNavigate).toHaveBeenCalledWith('/post');
    });

    describe('Messages unread badge', () => {
        it('shows the unread badge when authenticated with unread messages', () => {
            mockUseSession.mockReturnValue({ isAuthenticated: true, isSessionLoading: false });
            mockUnreadCount(4);

            renderBottomNav();

            expect(screen.getByText('4')).toBeInTheDocument();
            expect(screen.getByLabelText('4 unread messages')).toBeInTheDocument();
        });

        it('caps the badge display at 99+', () => {
            mockUseSession.mockReturnValue({ isAuthenticated: true, isSessionLoading: false });
            mockUnreadCount(150);

            renderBottomNav();

            expect(screen.getByText('99+')).toBeInTheDocument();
        });

        it('hides the badge when there are no unread messages', () => {
            mockUseSession.mockReturnValue({ isAuthenticated: true, isSessionLoading: false });
            mockUnreadCount(0);

            renderBottomNav();

            expect(screen.queryByLabelText(/unread message/)).not.toBeInTheDocument();
        });

        it('hides the badge and skips the query when signed out', () => {
            mockUseSession.mockReturnValue({ isAuthenticated: false, isSessionLoading: false });
            mockUnreadCount(9); // would show if the query weren't skipped

            renderBottomNav();

            expect(screen.queryByLabelText(/unread message/)).not.toBeInTheDocument();
            // The badge query must be auth-gated with "skip" while signed out
            expect(vi.mocked(useQuery)).toHaveBeenCalledWith(expect.anything(), 'skip');
        });
    });
});
