import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AdMessages } from './AdMessages';
import { useQuery, useMutation } from 'convex/react';
import { useSession } from '@descope/react-sdk';
import { useUserSync } from '../../context/UserSyncContext';

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

    describe('Message Display and Scroll Behavior', () => {
        beforeEach(() => {
            // Setup authenticated state
            (useSession as any).mockReturnValue({
                isAuthenticated: true,
                isSessionLoading: false,
            });

            (useUserSync as any).mockReturnValue({
                isUserSynced: true,
            });
        });

        it('should render messages in correct order (oldest to newest)', () => {
            const mockUseQuery = vi.fn()
                .mockReturnValueOnce(mockAd)
                .mockReturnValueOnce(mockChats)
                .mockReturnValueOnce(mockMessages);

            (useQuery as any).mockImplementation(mockUseQuery);

            const { container } = render(<AdMessages adId={mockAdId} onBack={mockOnBack} />);

            // Click on the first chat to select it
            const chatButton = screen.getByText('Test Buyer');
            chatButton.click();

            // Wait for messages to render
            waitFor(() => {
                const messageElements = container.querySelectorAll('.text-sm.whitespace-pre-wrap');
                expect(messageElements[0]).toHaveTextContent('First message');
                expect(messageElements[1]).toHaveTextContent('Second message');
            });
        });

        it('should have correct CSS classes for bottom alignment with scroll', () => {
            const mockUseQuery = vi.fn()
                .mockReturnValueOnce(mockAd)
                .mockReturnValueOnce(mockChats)
                .mockReturnValueOnce(mockMessages);

            (useQuery as any).mockImplementation(mockUseQuery);

            const { container } = render(<AdMessages adId={mockAdId} onBack={mockOnBack} />);

            // Click on chat to show messages
            const chatButton = screen.getByText('Test Buyer');
            chatButton.click();

            waitFor(() => {
                // Check outer container has overflow-y-auto for scrolling
                const scrollContainer = container.querySelector('.overflow-y-auto');
                expect(scrollContainer).toBeInTheDocument();
                expect(scrollContainer).toHaveClass('flex-1', 'min-h-0', 'overflow-y-auto');

                // Check inner wrapper has justify-end for bottom alignment
                const messageWrapper = container.querySelector('.min-h-full.justify-end');
                expect(messageWrapper).toBeInTheDocument();
                expect(messageWrapper).toHaveClass('flex', 'flex-col', 'space-y-4', 'min-h-full', 'justify-end');
            });
        });

        it('should have scrollIntoView ref at the end of messages', () => {
            const mockUseQuery = vi.fn()
                .mockReturnValueOnce(mockAd)
                .mockReturnValueOnce(mockChats)
                .mockReturnValueOnce(mockMessages);

            (useQuery as any).mockImplementation(mockUseQuery);

            const { container } = render(<AdMessages adId={mockAdId} onBack={mockOnBack} />);

            // Click on chat
            const chatButton = screen.getByText('Test Buyer');
            chatButton.click();

            waitFor(() => {
                // The ref div should be the last child of the message wrapper
                const messageWrapper = container.querySelector('.min-h-full.justify-end');
                const lastChild = messageWrapper?.lastElementChild;

                // It should be an empty div (the ref)
                expect(lastChild?.tagName).toBe('DIV');
                expect(lastChild?.textContent).toBe('');
            });
        });

        it('should maintain touch-action and overscroll-behavior for mobile scroll', () => {
            const mockUseQuery = vi.fn()
                .mockReturnValueOnce(mockAd)
                .mockReturnValueOnce(mockChats)
                .mockReturnValueOnce(mockMessages);

            (useQuery as any).mockImplementation(mockUseQuery);

            const { container } = render(<AdMessages adId={mockAdId} onBack={mockOnBack} />);

            // Click on chat
            const chatButton = screen.getByText('Test Buyer');
            chatButton.click();

            waitFor(() => {
                const scrollContainer = container.querySelector('.overflow-y-auto');
                const style = scrollContainer?.getAttribute('style');

                expect(style).toContain('touch-action: pan-y');
                expect(style).toContain('overscroll-behavior: contain');
            });
        });
    });

    describe('Message Alignment', () => {
        beforeEach(() => {
            (useSession as any).mockReturnValue({
                isAuthenticated: true,
                isSessionLoading: false,
            });

            (useUserSync as any).mockReturnValue({
                isUserSynced: true,
            });
        });

        it('should align seller messages to the right', () => {
            const mockUseQuery = vi.fn()
                .mockReturnValueOnce(mockAd)
                .mockReturnValueOnce(mockChats)
                .mockReturnValueOnce(mockMessages);

            (useQuery as any).mockImplementation(mockUseQuery);

            const { container } = render(<AdMessages adId={mockAdId} onBack={mockOnBack} />);

            // Click on chat
            const chatButton = screen.getByText('Test Buyer');
            chatButton.click();

            waitFor(() => {
                const messageContainers = container.querySelectorAll('.flex.justify-end, .flex.justify-start');

                // First message (from buyer) should be left-aligned
                expect(messageContainers[0]).toHaveClass('justify-start');

                // Second message (from seller) should be right-aligned
                expect(messageContainers[1]).toHaveClass('justify-end');
            });
        });

        it('should apply correct background colors to messages', () => {
            const mockUseQuery = vi.fn()
                .mockReturnValueOnce(mockAd)
                .mockReturnValueOnce(mockChats)
                .mockReturnValueOnce(mockMessages);

            (useQuery as any).mockImplementation(mockUseQuery);

            const { container } = render(<AdMessages adId={mockAdId} onBack={mockOnBack} />);

            // Click on chat
            const chatButton = screen.getByText('Test Buyer');
            chatButton.click();

            waitFor(() => {
                const messageBubbles = container.querySelectorAll('.rounded-lg');

                // Buyer message should have white background with border
                expect(messageBubbles[0]).toHaveClass('bg-white', 'border', 'border-neutral-200');

                // Seller message should have primary background
                expect(messageBubbles[1]).toHaveClass('bg-primary-50');
            });
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
