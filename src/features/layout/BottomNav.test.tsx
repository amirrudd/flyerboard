import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BottomNav } from './BottomNav';
import { BrowserRouter } from 'react-router-dom';

// Mock Descope SDK
const mockUseSession = vi.fn();
vi.mock('@descope/react-sdk', () => ({
    useSession: () => mockUseSession(),
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
        mockUseSession.mockReturnValue({ isAuthenticated: false });
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
});
