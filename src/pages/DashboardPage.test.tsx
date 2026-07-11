import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DashboardPage } from './DashboardPage';
import { getLegacyChatsRedirect } from '../lib/legacyChatsRedirect';

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

describe('getLegacyChatsRedirect', () => {
    it('maps ?tab=chats to /messages', () => {
        expect(getLegacyChatsRedirect('?tab=chats')).toBe('/messages');
    });

    it('maps ?tab=chats&chat=X to /messages/X', () => {
        expect(getLegacyChatsRedirect('?tab=chats&chat=abc123')).toBe('/messages/abc123');
    });

    it('carries the flyer param through (inbox shape)', () => {
        expect(getLegacyChatsRedirect('?tab=chats&flyer=ad42')).toBe('/messages?flyer=ad42');
    });

    it('carries the flyer param through (thread shape)', () => {
        expect(getLegacyChatsRedirect('?tab=chats&chat=abc123&flyer=ad42'))
            .toBe('/messages/abc123?flyer=ad42');
    });

    it('returns null for non-chats tabs even when chat/flyer params are present', () => {
        expect(getLegacyChatsRedirect('?tab=ads')).toBeNull();
        expect(getLegacyChatsRedirect('?tab=saved&chat=abc123')).toBeNull();
        expect(getLegacyChatsRedirect('')).toBeNull();
    });
});

describe('DashboardPage - legacy chats-tab redirect shim', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseSession.mockReturnValue({ isAuthenticated: true, isSessionLoading: false });
    });

    const renderAt = (url: string) =>
        render(
            <MemoryRouter initialEntries={[url]}>
                <DashboardPage />
            </MemoryRouter>
        );

    it('redirects ?tab=chats to /messages with replace and does not mount UserDashboard', () => {
        renderAt('/dashboard?tab=chats');

        expect(mockNavigate).toHaveBeenCalledWith('/messages', { replace: true });
        expect(mockNavigate).toHaveBeenCalledTimes(1);
        expect(screen.queryByTestId('user-dashboard')).not.toBeInTheDocument();
    });

    it('redirects ?tab=chats&chat=X to /messages/X', () => {
        renderAt('/dashboard?tab=chats&chat=abc123');

        expect(mockNavigate).toHaveBeenCalledWith('/messages/abc123', { replace: true });
        expect(screen.queryByTestId('user-dashboard')).not.toBeInTheDocument();
    });

    it('carries ?flyer= through the redirect', () => {
        renderAt('/dashboard?tab=chats&chat=abc123&flyer=ad42');

        expect(mockNavigate).toHaveBeenCalledWith('/messages/abc123?flyer=ad42', { replace: true });
    });

    it('does not redirect other tabs', () => {
        renderAt('/dashboard?tab=saved');

        expect(mockNavigate).not.toHaveBeenCalled();
        expect(screen.getByTestId('user-dashboard')).toBeInTheDocument();
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
