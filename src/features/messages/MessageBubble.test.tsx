import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MessageBubble } from './MessageBubble';

describe('MessageBubble', () => {
    beforeEach(() => {
        // framer-motion's useReducedMotion reads matchMedia
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

    it('right-aligns own messages with primary background', () => {
        render(<MessageBubble content="Hello there" timestamp={Date.now()} isOwn={true} />);

        const wrapper = screen.getByTestId('message-bubble');
        expect(wrapper.className).toContain('justify-end');
        expect(wrapper.className).not.toContain('justify-start');

        const bubble = wrapper.firstElementChild as HTMLElement;
        expect(bubble.className).toContain('bg-primary');
        expect(bubble.className).toContain('text-primary-foreground');
        expect(bubble.className).toContain('rounded-tr-sm');
    });

    it('left-aligns other messages with muted background and ring', () => {
        render(<MessageBubble content="Hi back" timestamp={Date.now()} isOwn={false} />);

        const wrapper = screen.getByTestId('message-bubble');
        expect(wrapper.className).toContain('justify-start');
        expect(wrapper.className).not.toContain('justify-end');

        const bubble = wrapper.firstElementChild as HTMLElement;
        expect(bubble.className).toContain('bg-muted/60');
        expect(bubble.className).toContain('ring-1');
        expect(bubble.className).toContain('ring-border/60');
        expect(bubble.className).toContain('rounded-tl-sm');
        expect(bubble.className).not.toContain('bg-primary ');
    });

    it('renders the message content preserving whitespace', () => {
        render(<MessageBubble content={'line one\nline two'} timestamp={Date.now()} isOwn={true} />);
        const content = screen.getByText(/line one/);
        expect(content.className).toContain('whitespace-pre-wrap');
    });

    it('renders a relative tabular-nums timestamp', () => {
        render(
            <MessageBubble
                content="Timed"
                timestamp={Date.now() - 5 * 60 * 1000}
                isOwn={false}
            />
        );
        const timestamp = screen.getByText(/minutes ago/);
        expect(timestamp.className).toContain('tabular-nums');
        expect(timestamp.className).toContain('text-[11px]');
    });
});
