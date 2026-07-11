import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Link } from 'react-router-dom';
import { useQuery, useMutation } from 'convex/react';
import { getFunctionName } from 'convex/server';
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

// Mock convex hooks — dispatch on function name (getFunctionName), the same
// convention as UserDashboard.test.tsx. "skip" always returns undefined.
vi.mock('convex/react', () => ({
    useQuery: vi.fn(),
    useMutation: vi.fn(() => vi.fn()),
}));

// useInbox / the archived view gate queries on user sync. Overridable per
// test so the authenticated-but-not-yet-synced window can be simulated.
const mockUseUserSync = vi.fn();
vi.mock('../context/UserSyncContext', () => ({
    useUserSync: () => mockUseUserSync(),
}));

// ImageDisplay hits convex useQuery internally — stub it out (as InboxRow.test does).
vi.mock('../components/ui/ImageDisplay', () => ({
    ImageDisplay: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

// ReportModal has its own convex wiring — only its open/closed contract
// matters to this page.
vi.mock('../components/ReportModal', () => ({
    ReportModal: ({ isOpen }: { isOpen: boolean }) =>
        isOpen ? <div data-testid="report-modal" /> : null,
}));

const mockToast = { success: vi.fn(), error: vi.fn() };
vi.mock('sonner', () => ({
    toast: {
        success: (...args: unknown[]) => mockToast.success(...args),
        error: (...args: unknown[]) => mockToast.error(...args),
    },
}));

// ── Query/mutation mocks keyed by Convex function name ─────────────────────
function mockQueries(overrides: Record<string, unknown> = {}) {
    const data: Record<string, unknown> = {
        'posts:getSellerChats': [],
        'posts:getBuyerChats': [],
        'messages:getArchivedChats': [],
        'messages:getChatMessages': [],
        ...overrides,
    };
    vi.mocked(useQuery).mockImplementation(((query: any, args?: any) => {
        if (args === 'skip') return undefined;
        return data[getFunctionName(query)];
    }) as any);
}

// Spies are typed promise-returning (mutations return promises) so tests can
// install pending/rejected implementations without fighting the void type.
type MutationSpy = ReturnType<typeof vi.fn<(...args: unknown[]) => Promise<unknown>>>;
let mutationSpies: Record<string, MutationSpy>;
function installMutationSpies() {
    mutationSpies = {};
    vi.mocked(useMutation).mockImplementation(((ref: any) => {
        const name = getFunctionName(ref);
        if (!mutationSpies[name]) {
            mutationSpies[name] = vi
                .fn<(...args: unknown[]) => Promise<unknown>>()
                .mockResolvedValue(undefined);
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

// Archived fixtures — backend shape has no unreadCount (buyer-side rows).
const archivedChat1 = {
    _id: 'chat-arch-1',
    adId: 'ad-9',
    buyerId: 'u1',
    sellerId: 'seller-2',
    lastMessageAt: 1500,
    latestMessage: { content: 'Thanks anyway', timestamp: 1500 },
    ad: { _id: 'ad-9', title: 'Old Lamp', price: 20, images: [], isActive: true },
    seller: { _id: 'seller-2', name: 'Sally Seller' },
};
const archivedChat2 = {
    _id: 'chat-arch-2',
    adId: 'ad-10',
    buyerId: 'u1',
    sellerId: 'seller-3',
    lastMessageAt: 1200,
    latestMessage: { content: 'Sold, sorry', timestamp: 1200 },
    ad: { _id: 'ad-10', title: 'Desk Chair', price: 45, images: [], isActive: true },
    seller: { _id: 'seller-3', name: 'Steve Seller' },
};

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

beforeEach(() => {
    vi.clearAllMocks();
    installMutationSpies();
    mockQueries();
    mockUseUserSync.mockReturnValue({ isUserSynced: true });
    // framer-motion's useReducedMotion needs matchMedia; jsdom lacks it.
    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query) => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        })),
    });
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
    setInnerWidth(originalInnerWidth);
});

describe('MessagesPage - Route Guard', () => {
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

    it('renders the thread route when authenticated (not-found for an unknown id)', () => {
        mockUseSession.mockReturnValue({ isAuthenticated: true, isSessionLoading: false });

        renderAt('/messages/chat123?flyer=ad42');

        expect(screen.getByText('Conversation not found')).toBeInTheDocument();
        expect(mockNavigate).not.toHaveBeenCalled();
    });
});

describe('MessagesPage - persistent header visibility', () => {
    beforeEach(() => {
        mockUseSession.mockReturnValue({ isAuthenticated: true, isSessionLoading: false });
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

describe('MessagesPage - inbox states', () => {
    beforeEach(() => {
        mockUseSession.mockReturnValue({ isAuthenticated: true, isSessionLoading: false });
    });

    it('shows 6 loading skeletons while the inbox queries resolve', () => {
        mockQueries({
            'posts:getSellerChats': undefined,
            'posts:getBuyerChats': undefined,
        });

        renderAt('/messages');

        const status = screen.getByRole('status', { name: 'Loading conversations' });
        expect(status.children).toHaveLength(6);
    });

    it('shows the true-empty state with a Browse flyers CTA linking home', () => {
        renderAt('/messages');

        expect(screen.getByText('No messages yet')).toBeInTheDocument();
        expect(
            screen.getByText('Conversations with buyers and sellers will appear here')
        ).toBeInTheDocument();
        const cta = screen.getByRole('link', { name: 'Browse flyers' });
        expect(cta).toHaveAttribute('href', '/');
    });

    it('shows the filtered-empty variant when a role filter has no conversations', () => {
        mockQueries({ 'posts:getBuyerChats': [buyerChat] });

        renderAt('/messages');

        fireEvent.click(screen.getByRole('tab', { name: 'Selling' }));

        expect(screen.getByText('No selling conversations yet.')).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Browse flyers' })).not.toBeInTheDocument();
    });

    it('renders conversation rows and navigates to the thread on tap', () => {
        mockQueries({
            'posts:getSellerChats': [sellerChat],
            'posts:getBuyerChats': [buyerChat],
        });

        renderAt('/messages');

        const row = screen.getByRole('button', { name: 'Conversation with Bella Buyer' });
        expect(screen.getByRole('button', { name: 'Conversation with Sam Seller' })).toBeInTheDocument();

        fireEvent.click(row);
        expect(mockNavigate).toHaveBeenCalledWith('/messages/chat-sell');
    });

    it('shows loading skeletons, not the empty state, while authenticated but not yet synced', () => {
        // Pre-sync window: queries are skipped, so both lists are undefined.
        mockUseUserSync.mockReturnValue({ isUserSynced: false });

        renderAt('/messages');

        expect(
            screen.getByRole('status', { name: 'Loading conversations' })
        ).toBeInTheDocument();
        expect(screen.queryByText('No messages yet')).not.toBeInTheDocument();
    });

    it('shows the Archive action on buying rows only (archived view is buyer-only)', () => {
        mockQueries({
            'posts:getSellerChats': [sellerChat],
            'posts:getBuyerChats': [buyerChat],
        });

        renderAt('/messages');

        const sellingRow = screen.getByRole('button', { name: 'Conversation with Bella Buyer' });
        const buyingRow = screen.getByRole('button', { name: 'Conversation with Sam Seller' });
        expect(within(sellingRow).queryByRole('button', { name: 'Archive' })).not.toBeInTheDocument();
        expect(within(buyingRow).getByRole('button', { name: 'Archive' })).toBeInTheDocument();
    });

    it('archives a buying conversation from the row Archive action', async () => {
        mockQueries({ 'posts:getBuyerChats': [buyerChat] });

        renderAt('/messages');

        fireEvent.click(screen.getByRole('button', { name: 'Archive' }));

        await waitFor(() => {
            expect(mutationSpies['messages:archiveChat']).toHaveBeenCalledWith({
                chatId: 'chat-buy',
            });
        });
        expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('keeps the row and shows an error toast when archiving fails', async () => {
        mockQueries({ 'posts:getBuyerChats': [buyerChat] });

        renderAt('/messages');
        mutationSpies['messages:archiveChat'].mockRejectedValue(new Error('Network down'));

        fireEvent.click(screen.getByRole('button', { name: 'Archive' }));

        await waitFor(() => {
            expect(mockToast.error).toHaveBeenCalledWith('Network down');
        });
        expect(
            screen.getByRole('button', { name: 'Conversation with Sam Seller' })
        ).toBeInTheDocument();
    });

    it('opens the overflow menu with an Archived link to /messages/archived', () => {
        renderAt('/messages');

        const trigger = screen.getByRole('button', { name: 'More options' });
        expect(trigger).toHaveAttribute('aria-expanded', 'false');

        fireEvent.click(trigger);

        expect(trigger).toHaveAttribute('aria-expanded', 'true');
        const item = screen.getByRole('menuitem', { name: 'Archived' });
        expect(item).toHaveAttribute('href', '/messages/archived');
    });
});

describe('MessagesPage - ?flyer= filter chip', () => {
    beforeEach(() => {
        mockUseSession.mockReturnValue({ isAuthenticated: true, isSessionLoading: false });
        mockQueries({
            'posts:getSellerChats': [sellerChat],
            'posts:getBuyerChats': [buyerChat],
        });
    });

    it('shows the chip with the matching conversation title and narrows the list', () => {
        renderAt('/messages?flyer=ad-1');

        expect(screen.getByText('Showing chats about: Blue Bike')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Conversation with Bella Buyer' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Conversation with Sam Seller' })).not.toBeInTheDocument();
    });

    it('shows a flyer-specific empty state (no Browse CTA) when nothing matches ?flyer=', () => {
        renderAt('/messages?flyer=ad-404');

        expect(screen.getByText('No conversations about this flyer yet.')).toBeInTheDocument();
        // The dismiss chip stays visible so the filter can be cleared.
        expect(
            screen.getByRole('button', { name: 'Stop showing chats about this flyer' })
        ).toBeInTheDocument();
        expect(screen.queryByText('No messages yet')).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Browse flyers' })).not.toBeInTheDocument();
    });

    it('dismissing the chip clears the filter and restores the full list', () => {
        renderAt('/messages?flyer=ad-1');

        fireEvent.click(
            screen.getByRole('button', { name: 'Stop showing chats about Blue Bike' })
        );

        expect(screen.queryByText(/Showing chats about:/)).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Conversation with Sam Seller' })).toBeInTheDocument();
    });
});

describe('MessagesPage - archived view', () => {
    beforeEach(() => {
        mockUseSession.mockReturnValue({ isAuthenticated: true, isSessionLoading: false });
        mockQueries({ 'messages:getArchivedChats': [archivedChat1, archivedChat2] });
    });

    it('renders archived rows with Unarchive actions and a back link', () => {
        renderAt('/messages/archived');

        expect(screen.getByRole('heading', { name: 'Archived Messages' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Back to Messages/ })).toHaveAttribute('href', '/messages');
        expect(screen.getByRole('button', { name: 'Conversation with Sally Seller' })).toBeInTheDocument();
        expect(screen.getAllByRole('button', { name: 'Unarchive' })).toHaveLength(2);
    });

    it('shows the empty state when nothing is archived', () => {
        mockQueries({ 'messages:getArchivedChats': [] });

        renderAt('/messages/archived');

        expect(screen.getByText('No archived messages')).toBeInTheDocument();
    });

    it('unarchives a chat from the row action', async () => {
        renderAt('/messages/archived');

        fireEvent.click(screen.getAllByRole('button', { name: 'Unarchive' })[0]);

        await waitFor(() => {
            expect(mutationSpies['messages:unarchiveChat']).toHaveBeenCalledWith({
                chatId: 'chat-arch-1',
            });
        });
    });

    it('gates bulk delete behind a confirm dialog that spells out the two-sided hard delete', async () => {
        renderAt('/messages/archived');

        fireEvent.click(screen.getByRole('button', { name: 'Select All' }));
        fireEvent.click(screen.getByRole('button', { name: 'Delete Selected (2)' }));

        // The confirm dialog is the gate — nothing deleted yet.
        const dialog = screen.getByRole('dialog');
        expect(within(dialog).getByText(/both you/i)).toBeInTheDocument();
        expect(within(dialog).getByText(/cannot be undone/i)).toBeInTheDocument();
        expect(mutationSpies['messages:deleteArchivedChats']).not.toHaveBeenCalled();

        fireEvent.click(within(dialog).getByRole('button', { name: 'Delete for both sides' }));

        await waitFor(() => {
            expect(mutationSpies['messages:deleteArchivedChats']).toHaveBeenCalledWith({
                chatIds: ['chat-arch-1', 'chat-arch-2'],
            });
        });
    });

    it('closes the confirm dialog on Escape without deleting', () => {
        renderAt('/messages/archived');

        fireEvent.click(screen.getByRole('button', { name: 'Select All' }));
        fireEvent.click(screen.getByRole('button', { name: 'Delete Selected (2)' }));
        expect(screen.getByRole('dialog')).toBeInTheDocument();

        fireEvent.keyDown(document, { key: 'Escape' });

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(mutationSpies['messages:deleteArchivedChats']).not.toHaveBeenCalled();
    });

    it('ignores Escape and backdrop clicks and disables Cancel while the delete is in flight', async () => {
        renderAt('/messages/archived');

        // Simulate a pending mutation the test controls.
        let resolveDelete!: () => void;
        mutationSpies['messages:deleteArchivedChats'].mockImplementation(
            () => new Promise<void>((resolve) => { resolveDelete = resolve; })
        );

        fireEvent.click(screen.getByRole('button', { name: 'Select All' }));
        fireEvent.click(screen.getByRole('button', { name: 'Delete Selected (2)' }));
        fireEvent.click(screen.getByRole('button', { name: 'Delete for both sides' }));

        // Delete in flight: the dialog must not be dismissible.
        fireEvent.keyDown(document, { key: 'Escape' });
        fireEvent.click(screen.getByRole('dialog'));
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();

        resolveDelete();
        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
    });

    it('cancelling the confirm dialog deletes nothing', () => {
        renderAt('/messages/archived');

        fireEvent.click(screen.getByRole('checkbox', { name: 'Select conversation about Old Lamp' }));
        fireEvent.click(screen.getByRole('button', { name: 'Delete Selected (1)' }));
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(mutationSpies['messages:deleteArchivedChats']).not.toHaveBeenCalled();
    });
});

// ── Conversation thread (/messages/:chatId) ─────────────────────────────────

// Sale + bundle thread fixtures (buyer side — u1 is the buyer).
const saleChat = {
    _id: 'chat-sale',
    saleEventId: 'sale-1',
    buyerId: 'u1',
    sellerId: 'seller-5',
    lastMessageAt: 900,
    unreadCount: 0,
    sale: { _id: 'sale-1', title: 'Garage Sale', slug: 'garage-sale' },
    seller: { _id: 'seller-5', name: 'Sally Sale' },
};
const bundleChat = {
    _id: 'chat-bundle',
    bundleId: 'bundle-1',
    buyerId: 'u1',
    sellerId: 'seller-6',
    lastMessageAt: 800,
    unreadCount: 0,
    bundle: { _id: 'bundle-1', label: 'Furniture Bundle' },
    seller: { _id: 'seller-6', name: 'Bo Bundle' },
};

// Two-party message fixture for chat-sell (u1 is the seller).
const chatSellMessages = [
    { _id: 'm1', content: 'Is the bike available?', timestamp: 1000, senderId: 'buyer-9' },
    { _id: 'm2', content: 'Yes, still here', timestamp: 2000, senderId: 'u1' },
];

describe('MessagesPage - conversation thread', () => {
    beforeEach(() => {
        // Mobile: the thread renders alone (full-screen portal). Desktop
        // two-pane duplicates list snippets next to bubbles — covered by the
        // dedicated two-pane describe below.
        setInnerWidth(390);
        mockUseSession.mockReturnValue({ isAuthenticated: true, isSessionLoading: false });
        mockQueries({
            'posts:getSellerChats': [sellerChat],
            'posts:getBuyerChats': [buyerChat, saleChat, bundleChat],
            'messages:getChatMessages': chatSellMessages,
        });
    });

    it('renders the messages with own/other alignment from the viewer role', () => {
        renderAt('/messages/chat-sell');

        expect(screen.getByText('Is the bike available?')).toBeInTheDocument();
        expect(screen.getByText('Yes, still here')).toBeInTheDocument();

        // u1 is the seller in chat-sell: buyer's message left, own right.
        const bubbles = screen.getAllByTestId('message-bubble');
        expect(bubbles[0].className).toContain('justify-start');
        expect(bubbles[1].className).toContain('justify-end');
    });

    it('shows the item context strip with a tappable View flyer action', () => {
        renderAt('/messages/chat-sell');

        expect(screen.getByText('Blue Bike')).toBeInTheDocument();
        expect(screen.getByText('Buyer: Bella Buyer')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'View flyer' }));
        expect(mockNavigate).toHaveBeenCalledWith('/ad/ad-1');
    });

    it('marks the conversation as read on mount (deep-link entry)', async () => {
        renderAt('/messages/chat-sell');

        await waitFor(() => {
            expect(mutationSpies['messages:markChatAsRead']).toHaveBeenCalledWith({
                chatId: 'chat-sell',
            });
        });
    });

    it('marks the new conversation as read when the open thread changes', async () => {
        const headerSlots = new HeaderSlotsStore();
        render(
            <HeaderSlotsContext.Provider value={headerSlots}>
                <MemoryRouter initialEntries={['/messages/chat-sell']}>
                    <Routes>
                        <Route
                            path="/messages/:chatId"
                            element={
                                <>
                                    <MessagesPage />
                                    <Link to="/messages/chat-buy">Switch thread</Link>
                                </>
                            }
                        />
                    </Routes>
                </MemoryRouter>
            </HeaderSlotsContext.Provider>
        );

        await waitFor(() => {
            expect(mutationSpies['messages:markChatAsRead']).toHaveBeenCalledWith({
                chatId: 'chat-sell',
            });
        });

        fireEvent.click(screen.getByText('Switch thread'));

        await waitFor(() => {
            expect(mutationSpies['messages:markChatAsRead']).toHaveBeenCalledWith({
                chatId: 'chat-buy',
            });
        });
    });

    it('back button navigates explicitly to /messages (never history.back)', () => {
        renderAt('/messages/chat-sell');

        fireEvent.click(screen.getByRole('button', { name: 'Back' }));

        expect(mockNavigate).toHaveBeenCalledWith('/messages');
    });

    it('sends a flyer-thread message through messages.sendMessage', async () => {
        renderAt('/messages/chat-sell');

        fireEvent.change(screen.getByLabelText('Type your message'), {
            target: { value: 'Sure, come by at 5' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

        await waitFor(() => {
            expect(mutationSpies['messages:sendMessage']).toHaveBeenCalledWith({
                chatId: 'chat-sell',
                content: 'Sure, come by at 5',
            });
        });
    });

    it('shows a loading state (not "not found") while the inbox is resolving', () => {
        mockQueries({
            'posts:getSellerChats': undefined,
            'posts:getBuyerChats': undefined,
        });

        renderAt('/messages/chat-sell');

        expect(screen.getByText('Loading conversation...')).toBeInTheDocument();
        expect(screen.queryByText('Conversation not found')).not.toBeInTheDocument();
    });
});

describe('MessagesPage - thread not-found state', () => {
    beforeEach(() => {
        setInnerWidth(390);
        mockUseSession.mockReturnValue({ isAuthenticated: true, isSessionLoading: false });
        mockQueries({
            'posts:getSellerChats': [sellerChat],
            'posts:getBuyerChats': [buyerChat],
        });
    });

    it('renders an in-page not-found state for a foreign or malformed id', () => {
        renderAt('/messages/not-a-real-chat-id');

        expect(screen.getByText('Conversation not found')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Back to messages' }));
        expect(mockNavigate).toHaveBeenCalledWith('/messages');
    });

    it('never subscribes to getChatMessages for a chat that is not in the inbox', () => {
        renderAt('/messages/not-a-real-chat-id');

        const liveMessageQueries = vi
            .mocked(useQuery)
            .mock.calls.filter(
                ([query, args]) =>
                    getFunctionName(query as never) === 'messages:getChatMessages' &&
                    args !== 'skip'
            );
        expect(liveMessageQueries).toHaveLength(0);
    });
});

describe('MessagesPage - thread kinds and availability', () => {
    beforeEach(() => {
        setInnerWidth(390);
        mockUseSession.mockReturnValue({ isAuthenticated: true, isSessionLoading: false });
    });

    it('sale thread: View sale navigates to the sale route and sends via messages.sendMessage', async () => {
        mockQueries({ 'posts:getBuyerChats': [saleChat] });

        renderAt('/messages/chat-sale');

        expect(screen.getByText('Garage Sale')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'View sale' }));
        expect(mockNavigate).toHaveBeenCalledWith('/sale/garage-sale');

        fireEvent.change(screen.getByLabelText('Type your message'), {
            target: { value: 'Is the couch still there?' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
        await waitFor(() => {
            expect(mutationSpies['messages:sendMessage']).toHaveBeenCalledWith({
                chatId: 'chat-sale',
                content: 'Is the couch still there?',
            });
        });
    });

    it('bundle thread: View bundle navigates to the bundle route', () => {
        mockQueries({ 'posts:getBuyerChats': [bundleChat] });

        renderAt('/messages/chat-bundle');

        expect(screen.getByText('Furniture Bundle')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'View bundle' }));
        expect(mockNavigate).toHaveBeenCalledWith('/bundle/bundle-1');
    });

    it('sold/inactive flyer: shows the No longer available pill, strip not tappable, composer still enabled', () => {
        const soldChat = {
            ...sellerChat,
            _id: 'chat-sold',
            ad: { ...sellerChat.ad, isActive: false },
        };
        mockQueries({ 'posts:getSellerChats': [soldChat] });

        renderAt('/messages/chat-sold');

        expect(screen.getByText('No longer available')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'View flyer' })).not.toBeInTheDocument();
        // Arranging pickup on a sold item is a real flow — sending stays open.
        expect(screen.getByLabelText('Type your message')).not.toBeDisabled();
        expect(screen.getByRole('button', { name: 'Send message' })).toBeInTheDocument();
    });

    it('deleted flyer: disables the composer with the dashboard reason copy', () => {
        const deletedAdChat = { ...sellerChat, _id: 'chat-del', ad: null };
        mockQueries({ 'posts:getSellerChats': [deletedAdChat] });

        renderAt('/messages/chat-del');

        expect(screen.getByLabelText('Type your message')).toBeDisabled();
        expect(screen.getByText('This flyer is no longer active')).toBeInTheDocument();
    });
});

describe('MessagesPage - desktop two-pane (≥md)', () => {
    beforeEach(() => {
        setInnerWidth(1280);
        mockUseSession.mockReturnValue({ isAuthenticated: true, isSessionLoading: false });
        mockQueries({
            'posts:getSellerChats': [sellerChat],
            'posts:getBuyerChats': [buyerChat],
            'messages:getChatMessages': chatSellMessages,
        });
    });

    it('shows the list next to a "Select a conversation" empty pane on /messages', () => {
        renderAt('/messages');

        expect(screen.getByRole('complementary', { name: 'Conversations' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Conversation with Bella Buyer' })).toBeInTheDocument();
        expect(screen.getByText('Select a conversation')).toBeInTheDocument();
        expect(screen.queryByTestId('conversation-thread')).not.toBeInTheDocument();
    });

    it('renders the open thread in the right pane with the active row highlighted', () => {
        renderAt('/messages/chat-sell');

        // Thread pane renders in normal flow (no full-screen portal wrapper).
        expect(screen.getByTestId('conversation-thread')).toBeInTheDocument();
        expect(screen.queryByText('Select a conversation')).not.toBeInTheDocument();

        // The open thread's row is highlighted via aria-current.
        expect(
            screen.getByRole('button', { name: 'Conversation with Bella Buyer' })
        ).toHaveAttribute('aria-current', 'true');
        expect(
            screen.getByRole('button', { name: 'Conversation with Sam Seller' })
        ).not.toHaveAttribute('aria-current');
    });

    it('selecting another row navigates to its /messages/:chatId URL (no ?chat= params)', () => {
        renderAt('/messages/chat-sell');

        fireEvent.click(screen.getByRole('button', { name: 'Conversation with Sam Seller' }));

        expect(mockNavigate).toHaveBeenCalledWith('/messages/chat-buy');
    });

    it('keeps the inbox list interactive alongside the thread (filters still work)', () => {
        renderAt('/messages/chat-sell');

        fireEvent.click(screen.getByRole('tab', { name: 'Buying' }));

        // The selling row leaves the list; the thread (URL-driven) stays open.
        expect(
            screen.queryByRole('button', { name: 'Conversation with Bella Buyer' })
        ).not.toBeInTheDocument();
        expect(screen.getByTestId('conversation-thread')).toBeInTheDocument();
    });
});
