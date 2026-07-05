import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminDashboardPage from './AdminDashboardPage';

vi.mock('../features/admin/AdminDashboard', () => ({
    AdminDashboard: ({ onBack }: any) => (
        <div data-testid="admin-dashboard">
            <button data-testid="back-button" onClick={onBack}>Back</button>
        </div>
    ),
}));

const mockUseSession = vi.fn();
vi.mock('@descope/react-sdk', () => ({
    useSession: () => mockUseSession(),
}));

const mockUseUserSync = vi.fn();
vi.mock('../context/UserSyncContext', () => ({
    useUserSync: () => mockUseUserSync(),
}));

// isCurrentUserAdmin query result: undefined = loading, true = admin, false = not admin
const mockUseQuery = vi.fn();
vi.mock('convex/react', () => ({
    useQuery: (...args: any[]) => mockUseQuery(...args),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});

describe('AdminDashboardPage - Route Guard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseUserSync.mockReturnValue({ isUserSynced: true });
        mockUseQuery.mockReturnValue(undefined);
    });

    it('shows PageLoader and does not navigate while session is loading', () => {
        mockUseSession.mockReturnValue({ isAuthenticated: false, isSessionLoading: true });

        render(
            <MemoryRouter>
                <AdminDashboardPage />
            </MemoryRouter>
        );

        expect(screen.getByText('Checking authentication...')).toBeInTheDocument();
        expect(screen.queryByTestId('admin-dashboard')).not.toBeInTheDocument();
        expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('redirects unauthenticated users to home and does not render AdminDashboard', () => {
        mockUseSession.mockReturnValue({ isAuthenticated: false, isSessionLoading: false });

        render(
            <MemoryRouter>
                <AdminDashboardPage />
            </MemoryRouter>
        );

        expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
        expect(screen.queryByTestId('admin-dashboard')).not.toBeInTheDocument();
    });

    it('shows PageLoader while the admin check is loading and does not navigate', () => {
        mockUseSession.mockReturnValue({ isAuthenticated: true, isSessionLoading: false });
        mockUseQuery.mockReturnValue(undefined);

        render(
            <MemoryRouter>
                <AdminDashboardPage />
            </MemoryRouter>
        );

        expect(screen.queryByTestId('admin-dashboard')).not.toBeInTheDocument();
        expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('redirects authenticated non-admins to home and does not render AdminDashboard', () => {
        mockUseSession.mockReturnValue({ isAuthenticated: true, isSessionLoading: false });
        mockUseQuery.mockReturnValue(false);

        render(
            <MemoryRouter>
                <AdminDashboardPage />
            </MemoryRouter>
        );

        expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
        expect(screen.queryByTestId('admin-dashboard')).not.toBeInTheDocument();
    });

    it('renders AdminDashboard for authenticated admins', () => {
        mockUseSession.mockReturnValue({ isAuthenticated: true, isSessionLoading: false });
        mockUseQuery.mockReturnValue(true);

        render(
            <MemoryRouter>
                <AdminDashboardPage />
            </MemoryRouter>
        );

        expect(screen.getByTestId('admin-dashboard')).toBeInTheDocument();
        expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('navigates to home on back', () => {
        mockUseSession.mockReturnValue({ isAuthenticated: true, isSessionLoading: false });
        mockUseQuery.mockReturnValue(true);

        render(
            <MemoryRouter>
                <AdminDashboardPage />
            </MemoryRouter>
        );

        fireEvent.click(screen.getByTestId('back-button'));
        expect(mockNavigate).toHaveBeenCalledWith('/');
    });
});
