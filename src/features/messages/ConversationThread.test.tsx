import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConversationThread } from './ConversationThread';
import type { ThreadMessage } from './types';

describe('ConversationThread', () => {
    const currentUserId = 'user-me';
    let scrollIntoViewMock: ReturnType<
        typeof vi.fn<(arg?: boolean | ScrollIntoViewOptions) => void>
    >;

    const messages: ThreadMessage[] = [
        { _id: 'm2', content: 'Second message', timestamp: 2000, senderId: 'user-other' },
        { _id: 'm3', content: 'Third message', timestamp: 3000, senderId: 'user-me' },
        { _id: 'm1', content: 'First message', timestamp: 1000, senderId: 'user-me' },
    ];

    beforeEach(() => {
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
        scrollIntoViewMock = vi.fn<(arg?: boolean | ScrollIntoViewOptions) => void>();
        Element.prototype.scrollIntoView = scrollIntoViewMock;
    });

    it('renders messages in chronological order (oldest to newest) even from unsorted input', () => {
        render(<ConversationThread messages={messages} currentUserId={currentUserId} />);

        const rendered = screen
            .getAllByTestId('message-bubble')
            .map((el) => el.textContent);

        expect(rendered[0]).toContain('First message');
        expect(rendered[1]).toContain('Second message');
        expect(rendered[2]).toContain('Third message');
    });

    it('has the protected scroll pattern: scrollable outer, bottom-aligned inner', () => {
        render(<ConversationThread messages={messages} currentUserId={currentUserId} />);

        const outer = screen.getByTestId('conversation-thread');
        // Outer container scrolls...
        expect(outer.className).toContain('flex-1');
        expect(outer.className).toContain('min-h-0');
        expect(outer.className).toContain('overflow-y-auto');
        // ...and must NOT be the bottom-aligning flex container.
        expect(outer.className).not.toContain('justify-end');
        expect(outer.className).not.toContain('flex-col-reverse');

        // Inner wrapper does the bottom alignment.
        const inner = outer.firstElementChild as HTMLElement;
        expect(inner.className).toContain('flex');
        expect(inner.className).toContain('flex-col');
        expect(inner.className).toContain('min-h-full');
        expect(inner.className).toContain('justify-end');
        expect(inner.className).not.toContain('flex-col-reverse');
    });

    it('sets touch-action and overscroll-behavior for mobile scrolling', () => {
        render(<ConversationThread messages={messages} currentUserId={currentUserId} />);

        const outer = screen.getByTestId('conversation-thread');
        expect(outer.style.touchAction).toBe('pan-y');
        expect(outer.style.overscrollBehavior).toBe('contain');
    });

    it('keeps the messagesEnd sentinel as the last child and scrolls it into view', () => {
        render(<ConversationThread messages={messages} currentUserId={currentUserId} />);

        const inner = screen.getByTestId('conversation-thread').firstElementChild as HTMLElement;
        expect(inner.lastElementChild).toBe(screen.getByTestId('messages-end'));
        expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: 'smooth' });
    });

    it('does not auto-scroll when there are no messages', () => {
        render(<ConversationThread messages={[]} currentUserId={currentUserId} />);
        expect(scrollIntoViewMock).not.toHaveBeenCalled();
    });

    it('aligns own messages right and other messages left based on currentUserId', () => {
        render(<ConversationThread messages={messages} currentUserId={currentUserId} />);

        const bubbles = screen.getAllByTestId('message-bubble');
        // Chronological: m1 (me), m2 (other), m3 (me)
        expect(bubbles[0].className).toContain('justify-end');
        expect(bubbles[1].className).toContain('justify-start');
        expect(bubbles[2].className).toContain('justify-end');
    });
});
