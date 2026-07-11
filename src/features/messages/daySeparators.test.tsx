import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { getDaySeparatorLabel, isSameLocalDay } from './daySeparators';
import { ConversationThread } from './ConversationThread';
import type { ThreadMessage } from './types';

const at = (iso: string) => new Date(iso).getTime();

describe('getDaySeparatorLabel', () => {
    // Fixed "now": Saturday 11 July 2026, 11:00 local time.
    const now = new Date('2026-07-11T11:00:00');

    it('labels any time today as "Today"', () => {
        expect(getDaySeparatorLabel(at('2026-07-11T00:00:01'), now)).toBe('Today');
        expect(getDaySeparatorLabel(at('2026-07-11T10:59:00'), now)).toBe('Today');
    });

    it('labels any time yesterday as "Yesterday"', () => {
        expect(getDaySeparatorLabel(at('2026-07-10T23:59:59'), now)).toBe('Yesterday');
        expect(getDaySeparatorLabel(at('2026-07-10T00:00:01'), now)).toBe('Yesterday');
    });

    it('labels older same-year days as an en-AU short date without the year', () => {
        // Exact ICU abbreviations vary ("Jul" vs "July") — assert the format
        // contract instead: the en-AU day+short-month string, no year.
        expect(getDaySeparatorLabel(at('2026-07-05T09:00:00'), now)).toBe(
            new Date('2026-07-05T09:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
        );
        const january = getDaySeparatorLabel(at('2026-01-02T09:00:00'), now);
        expect(january).toContain('2');
        expect(january).toMatch(/Jan/);
        expect(january).not.toContain('2026');
    });

    it('appends the year once it differs from the current year', () => {
        const label = getDaySeparatorLabel(at('2025-12-31T18:00:00'), now);
        expect(label).toContain('31');
        expect(label).toMatch(/Dec/);
        expect(label).toContain('2025');
    });
});

describe('isSameLocalDay', () => {
    it('treats two times on one calendar day as the same day', () => {
        expect(
            isSameLocalDay(at('2026-07-11T00:00:01'), at('2026-07-11T23:59:59'))
        ).toBe(true);
    });

    it('treats times across midnight as different days', () => {
        expect(
            isSameLocalDay(at('2026-07-10T23:59:59'), at('2026-07-11T00:00:01'))
        ).toBe(false);
    });
});

describe('ConversationThread day separators', () => {
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
        Element.prototype.scrollIntoView = vi.fn();
    });

    it('renders one separator per day cluster, before the first message of each day', () => {
        const messages: ThreadMessage[] = [
            { _id: 'm1', content: 'First of day one', timestamp: at('2026-07-05T09:00:00'), senderId: 'other' },
            { _id: 'm2', content: 'Second of day one', timestamp: at('2026-07-05T10:00:00'), senderId: 'me' },
            { _id: 'm3', content: 'First of day two', timestamp: at('2026-07-06T08:00:00'), senderId: 'me' },
        ];

        render(<ConversationThread messages={messages} currentUserId="me" />);

        const separators = screen.getAllByTestId('day-separator');
        expect(separators).toHaveLength(2);
        // Each separator precedes its day's first bubble in document order.
        const thread = screen.getByTestId('conversation-thread');
        const sequence = [
            ...thread.querySelectorAll('[data-testid="day-separator"], [data-testid="message-bubble"]'),
        ].map((el) =>
            el.getAttribute('data-testid') === 'day-separator'
                ? `sep:${el.getAttribute('aria-label')}`
                : `msg:${el.textContent?.slice(0, 5)}`
        );
        expect(sequence[0]).toMatch(/^sep:/);
        expect(sequence[1]).toBe('msg:First');
        expect(sequence[2]).toBe('msg:Secon');
        expect(sequence[3]).toMatch(/^sep:/);
        expect(sequence[4]).toBe('msg:First');
    });

    it('renders no separators for an empty thread', () => {
        render(<ConversationThread messages={[]} currentUserId="me" />);
        expect(screen.queryByTestId('day-separator')).not.toBeInTheDocument();
    });
});
