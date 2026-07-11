import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { MessagesPage } from './MessagesPage';
import { HeaderSlotsContext, HeaderSlotsStore } from '../features/layout/HeaderSlots';

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

// useDeviceInfo reads window.innerWidth (mobile is < 768) — same simulation
// approach as UserDashboard.test.tsx (NOT matchMedia).
const originalInnerWidth = window.innerWidth;
const setInnerWidth = (value: number) => {
    Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value,
    });
};

/**
 * Render MessagesPage at a real route (so useParams/useSearchParams work)
 * inside a real HeaderSlots provider, and return the store so tests can
 * assert what the page registered on the persistent header.
 */
const renderAt = (url: string) => {
    const headerSlots = new HeaderSlotsStore();
    const utils = render(
        <HeaderSlotsContext.Provider value={headerSlots}>
            <MemoryRouter initialEntries={[url]}>
                <Routes>
                    <Route path="/messages" element={<MessagesPage />} />
                    <Route path="/messages/:chatId" element={<MessagesPage />} />
                </Routes>
            </MemoryRouter>
        </HeaderSlotsContext.Provider>
    );
    return { ...utils, headerSlots };
};

describe('MessagesPage - Route Guard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        setInnerWidth(originalInnerWidth);
    });

    it('shows PageLoader and does not navigate while session is loading', () => {
        mockUseSession.mockReturnValue({ isAuthenticated: false, isSessionLoading: true });

        renderAt('/messages');

        expect(screen.getByText('Checking authentication...')).toBeInTheDocument();
        expect(screen.queryByRole('heading', { name: 'Messages' })).not.toBeInTheDocument();
        expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('redirects unauthenticated users to home and does not render the page', () => {
        mockUseSession.mockReturnValue({ isAuthenticated: false, isSessionLoading: false });

        renderAt('/messages');

        expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
        expect(screen.queryByRole('heading', { name: 'Messages' })).not.toBeInTheDocument();
    });

    it('renders the inbox route when authenticated', () => {
        mockUseSession.mockReturnValue({ isAuthenticated: true, isSessionLoading: false });

        renderAt('/messages');

        expect(screen.getByRole('heading', { name: 'Messages' })).toBeInTheDocument();
        expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('renders the thread route with the ?flyer= filter notice when authenticated', () => {
        mockUseSession.mockReturnValue({ isAuthenticated: true, isSessionLoading: false });

        renderAt('/messages/chat123?flyer=ad42');

        expect(screen.getByRole('heading', { name: 'Messages' })).toBeInTheDocument();
        expect(screen.getByText(/Showing chats about one flyer\./)).toBeInTheDocument();
        expect(mockNavigate).not.toHaveBeenCalled();
    });
});

describe('MessagesPage - persistent header visibility', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseSession.mockReturnValue({ isAuthenticated: true, isSessionLoading: false });
    });

    afterEach(() => {
        setInnerWidth(originalInnerWidth);
    });

    it('hides the header on a thread route at mobile width', () => {
        setInnerWidth(390);

        const { headerSlots } = renderAt('/messages/chat123');

        expect(headerSlots.getSnapshot()?.hidden).toBe(true);
    });

    it('keeps the header on the inbox route at mobile width', () => {
        setInnerWidth(390);

        const { headerSlots } = renderAt('/messages');

        expect(headerSlots.getSnapshot()?.hidden).not.toBe(true);
    });

    it('keeps the header on a thread route at desktop width', () => {
        setInnerWidth(1280);

        const { headerSlots } = renderAt('/messages/chat123');

        expect(headerSlots.getSnapshot()?.hidden).not.toBe(true);
    });

    it('keeps the header on /messages/archived at mobile width (inbox sub-view, not a thread)', () => {
        setInnerWidth(390);

        const { headerSlots } = renderAt('/messages/archived');

        expect(headerSlots.getSnapshot()?.hidden).not.toBe(true);
    });
});
