import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { UserDashboard } from './UserDashboard';
import { useQuery, useMutation } from 'convex/react';
import { getFunctionName } from 'convex/server';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});

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

// UserDashboard (and useInbox) gate queries on user sync
vi.mock('../../context/UserSyncContext', () => ({
    useUserSync: () => ({ isUserSynced: true }),
}));

// Browser push notifications — default mirrors jsdom (unsupported) so existing
// tests are unaffected; the push-card describe overrides pushState per test.
let pushState: any = {
    isSupported: false,
    permission: 'default',
    isSubscribed: false,
    isLoading: false,
    requestPermission: vi.fn(),
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
};
vi.mock('../../hooks/usePushNotifications', () => ({
    usePushNotifications: () => pushState,
}));

// MyAdCard → useBoostAction reads the marketplace refresh seam.
const mockRefreshAds = vi.fn();
vi.mock('../../context/MarketplaceContext', () => ({
    useMarketplace: () => ({ refreshAds: mockRefreshAds }),
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

// ── Query/mutation mocks keyed by Convex function name ─────────────────────
// The dashboard's useQuery call order changed with the unified inbox, so
// positional mockReturnValueOnce chains are too brittle. Dispatch on
// getFunctionName(queryRef) instead; "skip" always returns undefined
// (matching real convex behavior), which is what makes the unread-badge
// gating regression test meaningful.
const defaultUser = { _id: 'u1', name: 'Test User', email: 'test@test.com' };
const defaultStats = { totalAds: 0, totalViews: 0, averageRating: 0, ratingCount: 0 };

function mockQueries(overrides: Record<string, unknown> = {}) {
    const data: Record<string, unknown> = {
        'flag:movingSaleMode': true,
        'flag:identityVerification': false,
        'descopeAuth:getCurrentUserWithStats': { user: defaultUser, stats: defaultStats },
        'posts:getUserAds': [],
        'posts:getSellerChats': [],
        'posts:getBuyerChats': [],
        'adDetail:getSavedAds': [],
        'saleEvents:getSavedSaleEvents': [],
        'messages:getArchivedChats': [],
        'messages:getChatMessages': [],
        'messages:getUnreadCounts': {},
        'messages:getTotalUnreadCount': 0,
        ...overrides,
    };
    vi.mocked(useQuery).mockImplementation(((query: any, args?: any) => {
        if (args === 'skip') return undefined;
        const name = getFunctionName(query);
        if (name === 'featureFlags:getFeatureFlag') return data[`flag:${args?.key}`];
        return data[name];
    }) as any);
}

let mutationSpies: Record<string, ReturnType<typeof vi.fn>>;
function installMutationSpies() {
    mutationSpies = {};
    vi.mocked(useMutation).mockImplementation(((ref: any) => {
        const name = getFunctionName(ref);
        if (!mutationSpies[name]) {
            mutationSpies[name] = vi.fn().mockResolvedValue(undefined);
        }
        return mutationSpies[name];
    }) as any);
}

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
        installMutationSpies();
        // Default to authenticated for most tests
        mockUseSession.mockReturnValue({ isAuthenticated: true, isSessionLoading: false });
        mockUseUser.mockReturnValue({
            user: {
                name: 'Descope User',
                email: 'test@descope.com',
                picture: 'https://example.com/pic.jpg'
            }
        });
        mockQueries();
    });

    it('should show sign in message when user is not logged in', () => {
        mockUseSession.mockReturnValue({ isAuthenticated: false, isSessionLoading: false });
        mockQueries({ 'descopeAuth:getCurrentUserWithStats': undefined });

        renderDashboard();

        expect(screen.getByText('Please sign in')).toBeInTheDocument();
    });

    it('should render dashboard tabs when user is logged in', () => {
        renderDashboard();

        expect(screen.getAllByText('My Flyers')[0]).toBeInTheDocument();
        expect(screen.getAllByText('Messages')[0]).toBeInTheDocument();
        expect(screen.getAllByText('Saved Flyers')[0]).toBeInTheDocument();
        expect(screen.getByText('Profile')).toBeInTheDocument();
    });

    it('should show "No ads yet" when user has no ads', async () => {
        renderDashboard();

        await waitFor(() => {
            expect(screen.getByText('No Flyers Yet')).toBeInTheDocument();
        }, { timeout: 2000 });
        expect(screen.getByText('Pin Your First Flyer')).toBeInTheDocument();
    });

    it('should call onPostAd when button is clicked', () => {
        renderDashboard();

        const postButton = screen.getByText('Pin Next Flyer');
        fireEvent.click(postButton);

        expect(mockOnPostAd).toHaveBeenCalled();
    });

    it('falls back to My Flyers for retired ?tab values (chats/archived moved to /messages)', async () => {
        // Render with the retired archived tab in the URL
        render(
            <MemoryRouter initialEntries={['/dashboard?tab=archived']}>
                <UserDashboard
                    onBack={mockOnBack}
                    onPostAd={mockOnPostAd}
                    onEditAd={mockOnEditAd}
                />
            </MemoryRouter>
        );

        // Unknown/retired tabs are sanitized to "ads"
        await waitFor(() => {
            expect(screen.getByText('No Flyers Yet')).toBeInTheDocument();
        }, { timeout: 1000 });
        expect(screen.queryByText('Archived Messages')).not.toBeInTheDocument();
    });

    it('sidebar Messages entry navigates to /messages (with the unread badge)', () => {
        mockQueries({ 'messages:getTotalUnreadCount': 3 });

        renderDashboard();

        const nav = screen.getByRole('navigation', { name: 'Dashboard sections' });
        fireEvent.click(within(nav).getByRole('button', { name: /Messages/ }));

        expect(mockNavigate).toHaveBeenCalledWith('/messages');
    });

    it('per-ad Messages button navigates to the flyer-filtered /messages inbox', () => {
        mockQueries({
            'posts:getUserAds': [
                { _id: 'ad-1', title: 'Blue Bike', price: 50, images: [], views: 5, isActive: true },
            ],
        });

        renderDashboard();

        const card = screen.getByText('Blue Bike').closest('article')!;
        fireEvent.click(within(card).getByRole('button', { name: 'Messages' }));

        expect(mockNavigate).toHaveBeenCalledWith('/messages?flyer=ad-1');
    });

    it('keeps the legacy ?messages=<adId> deep link rendering AdMessages', () => {
        render(
            <MemoryRouter initialEntries={['/dashboard?messages=ad-1']}>
                <UserDashboard onBack={mockOnBack} onPostAd={mockOnPostAd} onEditAd={mockOnEditAd} />
            </MemoryRouter>
        );

        expect(screen.getByText('AdMessages')).toBeInTheDocument();
    });

    it('renders per-ad unread badges on the My Flyers tab (getUnreadCounts gating fix)', () => {
        mockQueries({
            'posts:getUserAds': [
                { _id: 'ad-1', title: 'Blue Bike', price: 50, images: [], views: 5, isActive: true },
            ],
            'messages:getUnreadCounts': { 'ad-1': 3 },
            'messages:getTotalUnreadCount': 0,
        });

        renderDashboard();

        // Badge only renders if getUnreadCounts runs on the "ads" tab — it was
        // previously gated on activeTab === "chats" and always skipped here.
        expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('shows the sidebar Messages badge from getTotalUnreadCount', () => {
        mockQueries({ 'messages:getTotalUnreadCount': 7 });

        renderDashboard();

        expect(screen.getByText('7')).toBeInTheDocument();
    });

    // ── Boost CTA (Phase 3) ────────────────────────────────────────────────
    const eligibleAd = {
        _id: 'ad-1', title: 'Old Couch', price: 100, images: [], views: 5,
        isActive: true, isSold: false, bumpedAt: 1, // epoch → long past cooldown
    };

    it('shows the "Boost to top" CTA on an eligible ad when the flag is on', () => {
        mockQueries({ 'flag:boostToTop': true, 'posts:getUserAds': [eligibleAd] });
        renderDashboard();
        expect(screen.getByRole('button', { name: 'Boost to top' })).toBeInTheDocument();
    });

    it('hides the Boost CTA entirely when the flag is off', () => {
        mockQueries({ 'flag:boostToTop': false, 'posts:getUserAds': [eligibleAd] });
        renderDashboard();
        expect(screen.queryByRole('button', { name: 'Boost to top' })).not.toBeInTheDocument();
    });

    it('renders no Boost CTA on a sold ad even with the flag on', () => {
        mockQueries({
            'flag:boostToTop': true,
            'posts:getUserAds': [{ ...eligibleAd, isSold: true }],
        });
        renderDashboard();
        expect(screen.queryByRole('button', { name: 'Boost to top' })).not.toBeInTheDocument();
    });

    it('opens the confirm modal and drives a successful boost + forced refresh', async () => {
        mockQueries({ 'flag:boostToTop': true, 'posts:getUserAds': [eligibleAd] });
        renderDashboard();

        fireEvent.click(screen.getByRole('button', { name: 'Boost to top' }));
        const dialog = screen.getByRole('dialog');
        expect(within(dialog).getByText('Boost this flyer?')).toBeInTheDocument();

        fireEvent.click(within(dialog).getByRole('button', { name: 'Boost to top' }));
        await waitFor(() => expect(mutationSpies['posts:boostAd']).toHaveBeenCalledWith({ adId: 'ad-1' }));
        await waitFor(() => expect(mockRefreshAds).toHaveBeenCalledWith(true));
    });
});

describe('Moving Sale banner', () => {
    const mockOnBack = vi.fn();
    const mockOnPostAd = vi.fn();
    const mockOnEditAd = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        installMutationSpies();
        mockUseSession.mockReturnValue({ isAuthenticated: true, isSessionLoading: false });
        mockUseUser.mockReturnValue({ user: { name: 'Test', email: 'test@test.com', picture: '' } });
    });

    it('renders the Moving house banner when movingSaleMode is enabled', () => {
        mockQueries({ 'flag:movingSaleMode': true });

        render(
            <MemoryRouter>
                <UserDashboard onBack={mockOnBack} onPostAd={mockOnPostAd} onEditAd={mockOnEditAd} />
            </MemoryRouter>
        );

        expect(screen.getByText('Moving house? Run a moving sale')).toBeInTheDocument();
    });

    it('hides the Moving house banner when movingSaleMode is disabled', () => {
        mockQueries({ 'flag:movingSaleMode': false });

        render(
            <MemoryRouter>
                <UserDashboard onBack={mockOnBack} onPostAd={mockOnPostAd} onEditAd={mockOnEditAd} />
            </MemoryRouter>
        );

        expect(screen.queryByText('Moving house? Run a moving sale')).not.toBeInTheDocument();
    });

    it('hides the Moving house banner while the feature flag is loading', () => {
        mockQueries({ 'flag:movingSaleMode': undefined });

        render(
            <MemoryRouter>
                <UserDashboard onBack={mockOnBack} onPostAd={mockOnPostAd} onEditAd={mockOnEditAd} />
            </MemoryRouter>
        );

        expect(screen.queryByText('Moving house? Run a moving sale')).not.toBeInTheDocument();
    });

    it('navigates to /sell/moving-sale when the banner is clicked', () => {
        mockQueries({ 'flag:movingSaleMode': true });

        render(
            <MemoryRouter>
                <UserDashboard onBack={mockOnBack} onPostAd={mockOnPostAd} onEditAd={mockOnEditAd} />
            </MemoryRouter>
        );

        fireEvent.click(screen.getByText('Moving house? Run a moving sale'));
        expect(mockNavigate).toHaveBeenCalledWith('/sell/moving-sale');
    });
});

describe('Browser notifications card (profile tab)', () => {
    const renderProfile = () =>
        render(
            <MemoryRouter initialEntries={['/dashboard?tab=profile']}>
                <UserDashboard onBack={vi.fn()} onPostAd={vi.fn()} onEditAd={vi.fn()} />
            </MemoryRouter>
        );

    beforeEach(() => {
        vi.clearAllMocks();
        installMutationSpies();
        mockUseSession.mockReturnValue({ isAuthenticated: true, isSessionLoading: false });
        mockUseUser.mockReturnValue({ user: { name: 'Test', email: 'test@test.com', picture: '' } });
        mockQueries();
        pushState = {
            isSupported: true,
            permission: 'default',
            isSubscribed: false,
            isLoading: false,
            requestPermission: vi.fn(),
            subscribe: vi.fn().mockResolvedValue(true),
            unsubscribe: vi.fn().mockResolvedValue(true),
        };
    });

    it('hides the card when push is unsupported', () => {
        pushState.isSupported = false;
        renderProfile();
        expect(screen.queryByText('Browser notifications')).not.toBeInTheDocument();
    });

    it('shows an Enable button that subscribes when tapped', async () => {
        renderProfile();
        expect(screen.getByText('Browser notifications')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /enable/i }));
        await waitFor(() => expect(pushState.subscribe).toHaveBeenCalled());
    });

    it('shows the blocked state instead of a button when permission is denied', () => {
        pushState.permission = 'denied';
        renderProfile();
        expect(screen.getByText('Blocked in browser')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /enable/i })).not.toBeInTheDocument();
    });

    it('shows a disable toggle when already subscribed', () => {
        pushState.permission = 'granted';
        pushState.isSubscribed = true;
        renderProfile();
        expect(screen.getByLabelText('Toggle browser notifications')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /enable/i })).not.toBeInTheDocument();
    });
});
