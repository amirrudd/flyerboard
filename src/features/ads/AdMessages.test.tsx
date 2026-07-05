import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AdMessages } from './AdMessages';
import { useQuery, useMutation } from 'convex/react';
import { useSession } from '@descope/react-sdk';
import { useUserSync } from '../../context/UserSyncContext';
import { api } from '../../../convex/_generated/api';

/**
 * `api.<module>.<fn>` is an `anyApi` Proxy — every property access mints a
 * brand-new Proxy object, so `fn === api.adDetail.getAdById` is never true
 * across two separate accesses. Convex stamps a stable dotted path onto each
 * reference via a well-known symbol; read that instead of using `===`.
 */
const FUNCTION_NAME = Symbol.for('functionName');
const apiPath = (fn: unknown): unknown => (fn as any)?.[FUNCTION_NAME];

/**
 * Builds a stable useQuery mock keyed by API function path (rather than call
 * order) so it survives re-renders triggered by user interaction — unlike a
 * `mockReturnValueOnce` chain, which only covers the first render and
 * silently returns undefined on the second (e.g. after clicking a row).
 */
function mockQueriesByApi(entries: {
    getAdById?: unknown;
    getAdChats?: unknown;
    getChatMessages?: unknown;
}) {
    const getAdByIdPath = apiPath(api.adDetail.getAdById);
    const getAdChatsPath = apiPath(api.messages.getAdChats);
    const getChatMessagesPath = apiPath(api.messages.getChatMessages);

    (useQuery as any).mockImplementation((fn: unknown, args: unknown) => {
        if (args === 'skip') return undefined;
        const path = apiPath(fn);
        if (path === getAdByIdPath) return entries.getAdById;
        if (path === getAdChatsPath) return entries.getAdChats;
        if (path === getChatMessagesPath) return entries.getChatMessages;
        return undefined;
    });
}

// Mock dependencies
vi.mock('convex/react');
vi.mock('@descope/react-sdk');
vi.mock('../../context/UserSyncContext');
vi.mock('sonner', () => ({
    toast: {
        error: vi.fn(),
    },
}));

// Mock react-dom createPortal
vi.mock('react-dom', () => ({
    createPortal: (children: any) => children,
}));

describe('AdMessages', () => {
    const mockAdId = 'test-ad-id' as any;
    const mockOnBack = vi.fn();

    const mockAd = {
        _id: mockAdId,
        title: 'Test Flyer',
        userId: 'seller-id',
    };

    const mockChats = [
        {
            _id: 'chat-1',
            buyerId: 'buyer-1',
            sellerId: 'seller-id',
            adId: mockAdId,
            lastMessageAt: Date.now(),
            buyer: { _id: 'buyer-1', name: 'Test Buyer' },
            latestMessage: { content: 'Hello', timestamp: Date.now() },
            unreadCount: 0,
        },
    ];

    const mockMessages = [
        {
            _id: 'msg-1',
            chatId: 'chat-1',
            senderId: 'buyer-1',
            content: 'First message',
            timestamp: Date.now() - 1000,
            sender: { _id: 'buyer-1', name: 'Test Buyer' },
        },
        {
            _id: 'msg-2',
            chatId: 'chat-1',
            senderId: 'seller-id',
            content: 'Second message',
            timestamp: Date.now(),
            sender: { _id: 'seller-id', name: 'Test Seller' },
        },
    ];

    beforeEach(() => {
        // Reset all mocks
        vi.clearAllMocks();

        // Default mock implementations
        (useSession as any).mockReturnValue({
            isAuthenticated: true,
            isSessionLoading: false,
        });

        (useUserSync as any).mockReturnValue({
            isUserSynced: true,
        });

        (useMutation as any).mockReturnValue(vi.fn());

        // ConversationThread auto-scrolls on open/new message; jsdom doesn't
        // implement scrollIntoView (see ConversationThread.test.tsx).
        Element.prototype.scrollIntoView = vi.fn();

        // Mock window.matchMedia for mobile detection
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
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // ─────────────────────────────────────────────────────────────────────
    // Protected: auth/sync gating. This container still owns the gating
    // logic (the shared useInbox hook is NOT used here — AdMessages queries
    // messages.getAdChats/getChatMessages directly), so these tests stay
    // against AdMessages itself. See ADMESSAGES_BEHAVIOR.md.
    // ─────────────────────────────────────────────────────────────────────
    describe('Authentication and User Sync', () => {
        it('should not query chats when user is not authenticated', () => {
            (useSession as any).mockReturnValue({
                isAuthenticated: false,
                isSessionLoading: false,
            });

            const mockUseQuery = vi.fn().mockReturnValue(undefined);
            (useQuery as any).mockImplementation(mockUseQuery);

            render(<AdMessages adId={mockAdId} onBack={mockOnBack} />);

            // Should skip the getAdChats query (second call)
            const calls = mockUseQuery.mock.calls;
            expect(calls[1][1]).toBe('skip'); // getAdChats should be skipped
        });

        it('should not query chats when session is loading', () => {
            (useSession as any).mockReturnValue({
                isAuthenticated: true,
                isSessionLoading: true,
            });

            const mockUseQuery = vi.fn().mockReturnValue(undefined);
            (useQuery as any).mockImplementation(mockUseQuery);

            render(<AdMessages adId={mockAdId} onBack={mockOnBack} />);

            // Should skip the getAdChats query
            const calls = mockUseQuery.mock.calls;
            expect(calls[1][1]).toBe('skip');
        });

        it('should not query chats when user is not synced to database', () => {
            (useUserSync as any).mockReturnValue({
                isUserSynced: false,
            });

            const mockUseQuery = vi.fn().mockReturnValue(undefined);
            (useQuery as any).mockImplementation(mockUseQuery);

            render(<AdMessages adId={mockAdId} onBack={mockOnBack} />);

            // Should skip the getAdChats query
            const calls = mockUseQuery.mock.calls;
            expect(calls[1][1]).toBe('skip');
        });

        it('should query chats only when authenticated AND user is synced', () => {
            (useSession as any).mockReturnValue({
                isAuthenticated: true,
                isSessionLoading: false,
            });

            (useUserSync as any).mockReturnValue({
                isUserSynced: true,
            });

            const mockUseQuery = vi.fn()
                .mockReturnValueOnce(mockAd) // getAdById
                .mockReturnValueOnce(mockChats) // getAdChats
                .mockReturnValueOnce(undefined); // getChatMessages

            (useQuery as any).mockImplementation(mockUseQuery);

            render(<AdMessages adId={mockAdId} onBack={mockOnBack} />);

            // Should NOT skip the getAdChats query
            const calls = mockUseQuery.mock.calls;
            expect(calls[1][1]).toEqual({ adId: mockAdId });
        });

        it('should show loading state when session is loading', () => {
            (useSession as any).mockReturnValue({
                isAuthenticated: true,
                isSessionLoading: true,
            });

            const mockUseQuery = vi.fn().mockReturnValue(undefined);
            (useQuery as any).mockImplementation(mockUseQuery);

            render(<AdMessages adId={mockAdId} onBack={mockOnBack} />);

            expect(screen.getByText('Loading...')).toBeInTheDocument();
        });
    });

    // ─────────────────────────────────────────────────────────────────────
    // Integration coverage. Message ordering, the protected scroll pattern,
    // touch-scroll styles, and bubble alignment now live in
    // src/features/messages/ConversationThread.test.tsx (shared component
    // owns that behavior). These tests instead assert that AdMessages wires
    // the shared components together correctly: the conversation list
    // renders via InboxRow, selecting a row opens a thread with a composer,
    // and the report button (previously unreachable dead code) now opens
    // the modal.
    // ─────────────────────────────────────────────────────────────────────
    describe('Conversation list and thread integration', () => {
        beforeEach(() => {
            (useSession as any).mockReturnValue({
                isAuthenticated: true,
                isSessionLoading: false,
            });

            (useUserSync as any).mockReturnValue({
                isUserSynced: true,
            });
        });

        it('renders the conversation list via InboxRow with buyer name, snippet, and unread count', () => {
            mockQueriesByApi({ getAdById: mockAd, getAdChats: mockChats });

            render(<AdMessages adId={mockAdId} onBack={mockOnBack} />);

            // InboxRow renders the buyer as the row's primary label and the
            // latest-message snippet.
            expect(screen.getByText('Test Buyer')).toBeInTheDocument();
            expect(screen.getByText('Hello')).toBeInTheDocument();
            // aria-label comes from InboxRow's row semantics.
            expect(
                screen.getByRole('button', { name: 'Conversation with Test Buyer' })
            ).toBeInTheDocument();
        });

        it('opens a thread with ConversationHeader + ConversationThread + MessageComposer when a row is selected', async () => {
            mockQueriesByApi({ getAdById: mockAd, getAdChats: mockChats, getChatMessages: mockMessages });

            render(<AdMessages adId={mockAdId} onBack={mockOnBack} />);

            fireEvent.click(
                screen.getByRole('button', { name: 'Conversation with Test Buyer' })
            );

            // ConversationHeader: buyer name as title.
            expect(
                screen.getByRole('heading', { name: 'Test Buyer' })
            ).toBeInTheDocument();

            // ConversationThread renders both messages as bubbles.
            const bubbles = await screen.findAllByTestId('message-bubble');
            expect(bubbles).toHaveLength(2);
            expect(bubbles[0]).toHaveTextContent('First message');
            expect(bubbles[1]).toHaveTextContent('Second message');

            // MessageComposer is present (Enter-to-send unification).
            expect(screen.getByLabelText('Type your message')).toBeInTheDocument();
            expect(
                screen.getByRole('button', { name: 'Send message' })
            ).toBeInTheDocument();
        });

        it('sends a message via the composer using messages.sendMessage', async () => {
            // AdMessages calls useMutation twice (sendMessage, markChatAsRead);
            // both resolve to the same stub here since only call args matter.
            const sendMessageMock = vi.fn().mockResolvedValue(undefined);
            (useMutation as any).mockReturnValue(sendMessageMock);

            mockQueriesByApi({ getAdById: mockAd, getAdChats: mockChats, getChatMessages: mockMessages });

            render(<AdMessages adId={mockAdId} onBack={mockOnBack} />);

            fireEvent.click(
                screen.getByRole('button', { name: 'Conversation with Test Buyer' })
            );

            const textarea = screen.getByLabelText('Type your message');
            fireEvent.change(textarea, { target: { value: 'Is it still available?' } });
            fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

            await waitFor(() => {
                expect(sendMessageMock).toHaveBeenCalledWith({
                    chatId: 'chat-1',
                    content: 'Is it still available?',
                });
            });
        });

        it('opens the report modal from the conversation header report button (previously unreachable)', async () => {
            mockQueriesByApi({ getAdById: mockAd, getAdChats: mockChats, getChatMessages: mockMessages });

            render(<AdMessages adId={mockAdId} onBack={mockOnBack} />);

            fireEvent.click(
                screen.getByRole('button', { name: 'Conversation with Test Buyer' })
            );

            fireEvent.click(
                screen.getByRole('button', { name: 'Report conversation' })
            );

            // ReportModal renders the reported entity name once open.
            expect(
                await screen.findByText('Conversation with Test Buyer')
            ).toBeInTheDocument();
        });
    });

    describe('Empty States', () => {
        beforeEach(() => {
            (useSession as any).mockReturnValue({
                isAuthenticated: true,
                isSessionLoading: false,
            });

            (useUserSync as any).mockReturnValue({
                isUserSynced: true,
            });
        });

        it('should show empty state when no chats exist', () => {
            const mockUseQuery = vi.fn()
                .mockReturnValueOnce(mockAd)
                .mockReturnValueOnce([]) // No chats
                .mockReturnValueOnce(undefined);

            (useQuery as any).mockImplementation(mockUseQuery);

            render(<AdMessages adId={mockAdId} onBack={mockOnBack} />);

            expect(screen.getByText('No messages yet')).toBeInTheDocument();
            expect(screen.getByText('Messages from interested buyers will appear here')).toBeInTheDocument();
        });

        it('should show select conversation prompt when no chat is selected', () => {
            const mockUseQuery = vi.fn()
                .mockReturnValueOnce(mockAd)
                .mockReturnValueOnce(mockChats)
                .mockReturnValueOnce(undefined);

            (useQuery as any).mockImplementation(mockUseQuery);

            render(<AdMessages adId={mockAdId} onBack={mockOnBack} />);

            expect(screen.getByText('Select a conversation')).toBeInTheDocument();
        });
    });
});
