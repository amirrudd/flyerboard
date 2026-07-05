import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InboxRow } from './InboxRow';
import type { InboxChat } from './types';

// ImageDisplay hits convex useQuery — stub it out.
vi.mock('../../components/ui/ImageDisplay', () => ({
    ImageDisplay: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

describe('InboxRow', () => {
    const baseChat: InboxChat = {
        _id: 'chat-1',
        adId: 'ad-1',
        buyerId: 'buyer-1',
        sellerId: 'seller-1',
        lastMessageAt: Date.now() - 10 * 60 * 1000,
        unreadCount: 3,
        latestMessage: { content: 'Is this still available?', timestamp: Date.now() },
        ad: {
            _id: 'ad-1',
            title: 'Vintage Bike',
            price: 250,
            images: ['r2:flyers/ad-1/img1'],
            isActive: true,
        },
        buyer: { _id: 'buyer-1', name: 'Bea Buyer' },
        seller: { _id: 'seller-1', name: 'Sam Seller' },
    };

    beforeEach(() => {
        vi.clearAllMocks();
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

    it('renders counterpart name, snippet, unread badge, and role chip for a selling row', () => {
        render(<InboxRow chat={baseChat} role="selling" onOpen={vi.fn()} />);

        expect(screen.getByText('Bea Buyer')).toBeInTheDocument();
        expect(screen.getByText('Is this still available?')).toBeInTheDocument();
        expect(screen.getByText('3')).toBeInTheDocument();
        expect(screen.getByText('Selling')).toBeInTheDocument();
        expect(screen.getByText('Vintage Bike')).toBeInTheDocument();
        expect(screen.getByText(/minutes ago/)).toBeInTheDocument();
    });

    it('shows the seller as counterpart with a Buying chip for a buying row', () => {
        render(<InboxRow chat={baseChat} role="buying" onOpen={vi.fn()} />);

        expect(screen.getByText('Sam Seller')).toBeInTheDocument();
        expect(screen.getByText('Buying')).toBeInTheDocument();
        expect(screen.queryByText('Bea Buyer')).not.toBeInTheDocument();
    });

    it('shows a Sale chip and sale title for moving-sale threads', () => {
        const saleChat: InboxChat = {
            ...baseChat,
            adId: undefined,
            ad: null,
            saleEventId: 'sale-1',
            sale: { _id: 'sale-1', title: 'Big Moving Sale', slug: 'big-moving-sale' },
        };
        render(<InboxRow chat={saleChat} role="selling" onOpen={vi.fn()} />);

        expect(screen.getByText('Sale')).toBeInTheDocument();
        expect(screen.getByText('Big Moving Sale')).toBeInTheDocument();
    });

    it('hides the unread badge at 0 and caps it at 99+', () => {
        const { rerender } = render(
            <InboxRow chat={{ ...baseChat, unreadCount: 0 }} role="selling" onOpen={vi.fn()} />
        );
        expect(screen.queryByLabelText(/unread/)).not.toBeInTheDocument();

        rerender(
            <InboxRow chat={{ ...baseChat, unreadCount: 150 }} role="selling" onOpen={vi.fn()} />
        );
        expect(screen.getByText('99+')).toBeInTheDocument();
    });

    it('falls back to "Deleted User" and "Deleted Flyer" when relations are gone', () => {
        const orphaned: InboxChat = { ...baseChat, buyer: null, ad: null };
        render(<InboxRow chat={orphaned} role="selling" onOpen={vi.fn()} />);

        expect(screen.getByText('Deleted User')).toBeInTheDocument();
        expect(screen.getByText('Deleted Flyer')).toBeInTheDocument();
    });

    it('opens the chat when the row is clicked or activated by keyboard', () => {
        const onOpen = vi.fn();
        render(<InboxRow chat={baseChat} role="selling" onOpen={onOpen} />);

        const row = screen.getByRole('button', { name: 'Conversation with Bea Buyer' });
        fireEvent.click(row);
        expect(onOpen).toHaveBeenCalledWith('chat-1');

        fireEvent.keyDown(row, { key: 'Enter' });
        expect(onOpen).toHaveBeenCalledTimes(2);
    });

    it('sets aria-current on the active row only', () => {
        const { rerender } = render(
            <InboxRow chat={baseChat} role="selling" onOpen={vi.fn()} isActive />
        );
        const row = screen.getByRole('button', { name: 'Conversation with Bea Buyer' });
        expect(row).toHaveAttribute('aria-current', 'true');

        rerender(<InboxRow chat={baseChat} role="selling" onOpen={vi.fn()} />);
        expect(row).not.toHaveAttribute('aria-current');
    });

    it('archives without opening the chat', () => {
        const onOpen = vi.fn();
        const onArchive = vi.fn();
        render(
            <InboxRow chat={baseChat} role="selling" onOpen={onOpen} onArchive={onArchive} />
        );

        fireEvent.click(screen.getByRole('button', { name: 'Archive' }));
        expect(onArchive).toHaveBeenCalledWith('chat-1');
        expect(onOpen).not.toHaveBeenCalled();
    });

    it('renders no Archive button when onArchive is not provided', () => {
        render(<InboxRow chat={baseChat} role="selling" onOpen={vi.fn()} />);
        expect(screen.queryByRole('button', { name: 'Archive' })).not.toBeInTheDocument();
    });
});
