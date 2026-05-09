import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DashboardPage } from './DashboardPage';

vi.mock('../features/dashboard/UserDashboard', () => ({
    UserDashboard: ({ onBack, onPostAd, onEditAd }: any) => (
        <div data-testid="user-dashboard">
            <button data-testid="back-button" onClick={onBack}>Back</button>
            <button data-testid="post-button" onClick={onPostAd}>Post</button>
            <button
                data-testid="edit-button"
                onClick={() => onEditAd({ _id: 'ad1' })}
            >Edit</button>
        </div>
    ),
}));

const mockUseSession = vi.fn();
vi.mock('@descope/react-sdk', () => ({
    useSession: () => mockUseSession(),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});

describe('DashboardPage - Route Guard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('shows PageLoader and does not navigate while session is loading', () => {
        mockUseSession.mockReturnValue({ isAuthenticated: false, isSessionLoading: true });

        render(
            <MemoryRouter>
                <DashboardPage />
            </MemoryRouter>
        );

        expect(screen.getByText('Checking authentication...')).toBeInTheDocument();
        expect(screen.queryByTestId('user-dashboard')).not.toBeInTheDocument();
        expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('redirects unauthenticated users to home and does not render UserDashboard', () => {
        mockUseSession.mockReturnValue({ isAuthenticated: false, isSessionLoading: false });

        render(
            <MemoryRouter>
                <DashboardPage />
            </MemoryRouter>
        );

        expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
        expect(screen.queryByTestId('user-dashboard')).not.toBeInTheDocument();
    });

    it('renders UserDashboard when authenticated', () => {
        mockUseSession.mockReturnValue({ isAuthenticated: true, isSessionLoading: false });

        render(
            <MemoryRouter>
                <DashboardPage />
            </MemoryRouter>
        );

        expect(screen.getByTestId('user-dashboard')).toBeInTheDocument();
        expect(mockNavigate).not.toHaveBeenCalled();
    });
});

describe('DashboardPage - Navigation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseSession.mockReturnValue({ isAuthenticated: true, isSessionLoading: false });
    });

    it('navigates to home on back', () => {
        render(
            <MemoryRouter>
                <DashboardPage />
            </MemoryRouter>
        );

        fireEvent.click(screen.getByTestId('back-button'));
        expect(mockNavigate).toHaveBeenCalledWith('/');
    });

    it('navigates to /post with from=/dashboard on post', () => {
        render(
            <MemoryRouter>
                <DashboardPage />
            </MemoryRouter>
        );

        fireEvent.click(screen.getByTestId('post-button'));
        expect(mockNavigate).toHaveBeenCalledWith('/post', { state: { from: '/dashboard' } });
    });

    it('navigates to /post with editingAd on edit', () => {
        render(
            <MemoryRouter>
                <DashboardPage />
            </MemoryRouter>
        );

        fireEvent.click(screen.getByTestId('edit-button'));
        expect(mockNavigate).toHaveBeenCalledWith('/post', {
            state: { editingAd: { _id: 'ad1' }, from: '/dashboard' },
        });
    });
});
