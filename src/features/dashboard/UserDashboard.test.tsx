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

// Inbox fixtures: one selling-side chat (newer) + one buying-side chat (older)
const sellerChat = {
    _id: 'chat-sell',
    adId: 'ad-1',
    buyerId: 'buyer-9',
    sellerId: 'u1',
    lastMessageAt: 2000,
    unreadCount: 2,
    latestMessage: { content: 'Is the bike available?', timestamp: 2000 },
    ad: { _id: 'ad-1', title: 'Blue Bike', price: 50, images: [], isActive: true },
    buyer: { _id: 'buyer-9', name: 'Bella Buyer' },
};
const buyerChat = {
    _id: 'chat-buy',
    adId: 'ad-2',
    buyerId: 'u1',
    sellerId: 'seller-7',
    lastMessageAt: 1000,
    unreadCount: 0,
    latestMessage: { content: 'Still for sale?', timestamp: 1000 },
    ad: { _id: 'ad-2', title: 'Red Couch', price: 200, images: [], isActive: true },
    seller: { _id: 'seller-7', name: 'Sam Seller' },
};

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

    it('should redirect to ads tab when accessing invalid tabs on mobile', async () => {
        // Simulate a mobile viewport (useDeviceInfo reads window.innerWidth)
        const originalInnerWidth = window.innerWidth;
        Object.defineProperty(window, 'innerWidth', {
            writable: true,
            configurable: true,
            value: 500,
        });

        // Render with archived tab in URL
        render(
            <MemoryRouter initialEntries={['/dashboard?tab=archived']}>
                <UserDashboard
                    onBack={mockOnBack}
                    onPostAd={mockOnPostAd}
                    onEditAd={mockOnEditAd}
                />
            </MemoryRouter>
        );

        // Should redirect to ads tab on mobile (archived tab is desktop-only)
        await waitFor(() => {
            expect(screen.queryByText('Archived Messages')).not.toBeInTheDocument();
        }, { timeout: 1000 });

        Object.defineProperty(window, 'innerWidth', {
            writable: true,
            configurable: true,
            value: originalInnerWidth,
        });
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
});

describe('Unified inbox (chats tab)', () => {
    const mockOnBack = vi.fn();
    const mockOnPostAd = vi.fn();
    const mockOnEditAd = vi.fn();

    const renderAt = (path: string) =>
        render(
            <MemoryRouter initialEntries={[path]}>
                <UserDashboard onBack={mockOnBack} onPostAd={mockOnPostAd} onEditAd={mockOnEditAd} />
            </MemoryRouter>
        );

    beforeEach(() => {
        vi.clearAllMocks();
        installMutationSpies();
        // jsdom doesn't implement scrollIntoView (ConversationThread auto-scroll)
        Element.prototype.scrollIntoView = vi.fn();
        mockUseSession.mockReturnValue({ isAuthenticated: true, isSessionLoading: false });
        mockUseUser.mockReturnValue({ user: { name: 'Test', email: 'test@test.com', picture: '' } });
        mockQueries({
            'posts:getSellerChats': [sellerChat],
            'posts:getBuyerChats': [buyerChat],
        });
    });

    it('renders both selling and buying conversations sorted by recency', () => {
        renderAt('/dashboard?tab=chats');

        const rows = screen.getAllByRole('button', { name: /^Conversation with/ });
        expect(rows).toHaveLength(2);
        expect(rows[0]).toHaveAccessibleName('Conversation with Bella Buyer'); // newer (selling)
        expect(rows[1]).toHaveAccessibleName('Conversation with Sam Seller'); // older (buying)
    });

    it('filters the list when switching between All / Selling / Buying', async () => {
        renderAt('/dashboard?tab=chats');

        fireEvent.click(screen.getByRole('tab', { name: 'Selling' }));
        await waitFor(() => {
            expect(screen.queryByRole('button', { name: 'Conversation with Sam Seller' })).not.toBeInTheDocument();
        });
        expect(screen.getByRole('button', { name: 'Conversation with Bella Buyer' })).toBeInTheDocument();

        fireEvent.click(screen.getByRole('tab', { name: 'Buying' }));
        await waitFor(() => {
            expect(screen.queryByRole('button', { name: 'Conversation with Bella Buyer' })).not.toBeInTheDocument();
        });
        expect(screen.getByRole('button', { name: 'Conversation with Sam Seller' })).toBeInTheDocument();

        fireEvent.click(screen.getByRole('tab', { name: 'All' }));
        await waitFor(() => {
            expect(screen.getAllByRole('button', { name: /^Conversation with/ })).toHaveLength(2);
        });
    });

    it('shows the per-filter empty state copy', async () => {
        mockQueries({ 'posts:getSellerChats': [], 'posts:getBuyerChats': [] });
        renderAt('/dashboard?tab=chats');

        expect(screen.getByText('No messages yet')).toBeInTheDocument();
        expect(screen.getByText('Conversations with buyers and sellers will appear here')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('tab', { name: 'Selling' }));
        await waitFor(() => {
            expect(screen.getByText('No buyer messages yet')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('tab', { name: 'Buying' }));
        await waitFor(() => {
            expect(screen.getByText('Nothing here yet')).toBeInTheDocument();
        });
    });

    it('opens the conversation thread from a ?chat deep link and marks it read', async () => {
        mockQueries({
            'posts:getSellerChats': [sellerChat],
            'posts:getBuyerChats': [buyerChat],
            'messages:getChatMessages': [
                { _id: 'm1', content: 'Is the bike available?', timestamp: 2000, senderId: 'buyer-9' },
            ],
        });

        renderAt('/dashboard?tab=chats&chat=chat-sell');

        const thread = screen.getByTestId('conversation-thread');
        expect(thread).toBeInTheDocument();
        // Item context strip shows the flyer
        expect(screen.getByRole('heading', { name: 'Blue Bike' })).toBeInTheDocument();
        // Thread renders the message (the InboxRow snippet shows it too, so scope)
        expect(within(thread).getByText('Is the bike available?')).toBeInTheDocument();

        await waitFor(() => {
            expect(mutationSpies['messages:markChatAsRead']).toHaveBeenCalledWith({ chatId: 'chat-sell' });
        });
    });

    it('sends via the shared composer with the open chat id', async () => {
        renderAt('/dashboard?tab=chats&chat=chat-sell');

        fireEvent.change(screen.getByPlaceholderText('Type your message...'), {
            target: { value: 'Yes, still here!' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

        await waitFor(() => {
            expect(mutationSpies['messages:sendMessage']).toHaveBeenCalledWith({
                chatId: 'chat-sell',
                content: 'Yes, still here!',
            });
        });
    });

    it('disables the composer when the flyer is inactive', () => {
        mockQueries({
            'posts:getSellerChats': [
                { ...sellerChat, ad: { ...sellerChat.ad, isActive: false } },
            ],
            'posts:getBuyerChats': [],
        });

        renderAt('/dashboard?tab=chats&chat=chat-sell');

        expect(screen.getByPlaceholderText('Type your message...')).toBeDisabled();
        expect(screen.getByText('This flyer is no longer active')).toBeInTheDocument();
    });

    it('pre-filters by flyer via ?flyer deep link and shows a removable chip', async () => {
        renderAt('/dashboard?tab=chats&flyer=ad-1');

        // Only the ad-1 conversation is listed
        expect(screen.getByRole('button', { name: 'Conversation with Bella Buyer' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Conversation with Sam Seller' })).not.toBeInTheDocument();

        // Removable chip labelled with the flyer title
        const chip = screen.getByRole('button', { name: 'Remove flyer filter: Blue Bike' });
        expect(chip).toHaveTextContent('Filtering: Blue Bike');

        fireEvent.click(chip);
        await waitFor(() => {
            expect(screen.getAllByRole('button', { name: /^Conversation with/ })).toHaveLength(2);
        });
    });

    it('updates the URL when opening and closing a conversation', async () => {
        renderAt('/dashboard?tab=chats');

        fireEvent.click(screen.getByRole('button', { name: 'Conversation with Bella Buyer' }));

        // Thread pane opens (URL now carries ?chat=…)
        await waitFor(() => {
            expect(screen.getByTestId('conversation-thread')).toBeInTheDocument();
        });

        // Back returns to the list-only state
        fireEvent.click(screen.getByRole('button', { name: 'Back' }));
        await waitFor(() => {
            expect(screen.queryByTestId('conversation-thread')).not.toBeInTheDocument();
        });
    });

    it('archives a conversation from the inbox row', async () => {
        renderAt('/dashboard?tab=chats');

        fireEvent.click(screen.getAllByRole('button', { name: 'Archive' })[0]);

        await waitFor(() => {
            expect(mutationSpies['messages:archiveChat']).toHaveBeenCalledWith({ chatId: 'chat-sell' });
        });
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
