import { describe, it, expect } from 'vitest';
import {
    mergeInboxChats,
    filterInboxConversations,
} from './useInbox';
import type { InboxChat } from './types';

function chat(overrides: Partial<InboxChat> & { _id: string }): InboxChat {
    return {
        buyerId: 'buyer-1',
        sellerId: 'seller-1',
        lastMessageAt: 0,
        unreadCount: 0,
        ...overrides,
    };
}

describe('mergeInboxChats', () => {
    it('tags seller chats as selling and buyer chats as buying', () => {
        const merged = mergeInboxChats(
            [chat({ _id: 's1', lastMessageAt: 100 })],
            [chat({ _id: 'b1', lastMessageAt: 200 })]
        );

        expect(merged.find((c) => c._id === 's1')?.role).toBe('selling');
        expect(merged.find((c) => c._id === 'b1')?.role).toBe('buying');
    });

    it('sorts the merged list by lastMessageAt desc even when inputs are unsorted', () => {
        const merged = mergeInboxChats(
            [chat({ _id: 's-old', lastMessageAt: 100 }), chat({ _id: 's-new', lastMessageAt: 400 })],
            [chat({ _id: 'b-mid', lastMessageAt: 300 }), chat({ _id: 'b-older', lastMessageAt: 50 })]
        );

        expect(merged.map((c) => c._id)).toEqual(['s-new', 'b-mid', 's-old', 'b-older']);
    });

    it('treats undefined inputs (loading / skipped queries) as empty lists', () => {
        expect(mergeInboxChats(undefined, undefined)).toEqual([]);
        expect(
            mergeInboxChats(undefined, [chat({ _id: 'b1', lastMessageAt: 1 })])
        ).toHaveLength(1);
        expect(
            mergeInboxChats([chat({ _id: 's1', lastMessageAt: 1 })], undefined)
        ).toHaveLength(1);
    });
});

describe('filterInboxConversations', () => {
    const conversations = mergeInboxChats(
        [
            chat({ _id: 's1', adId: 'ad-1', lastMessageAt: 400 }),
            chat({ _id: 's2', adId: 'ad-2', lastMessageAt: 300 }),
        ],
        [chat({ _id: 'b1', adId: 'ad-1', lastMessageAt: 200 })]
    );

    it("returns everything for 'all'", () => {
        expect(filterInboxConversations(conversations, 'all')).toHaveLength(3);
    });

    it("returns only seller-side rows for 'selling'", () => {
        const selling = filterInboxConversations(conversations, 'selling');
        expect(selling.map((c) => c._id)).toEqual(['s1', 's2']);
    });

    it("returns only buyer-side rows for 'buying'", () => {
        const buying = filterInboxConversations(conversations, 'buying');
        expect(buying.map((c) => c._id)).toEqual(['b1']);
    });

    it('narrows to a single flyer when flyerId is provided', () => {
        const forFlyer = filterInboxConversations(conversations, 'all', 'ad-1');
        expect(forFlyer.map((c) => c._id)).toEqual(['s1', 'b1']);
    });

    it('combines role filter and flyerId filter', () => {
        const sellingForFlyer = filterInboxConversations(conversations, 'selling', 'ad-1');
        expect(sellingForFlyer.map((c) => c._id)).toEqual(['s1']);
    });

    it('excludes sale threads (no adId) when filtering by flyerId', () => {
        const withSale = mergeInboxChats(
            [chat({ _id: 'sale-thread', saleEventId: 'sale-1', lastMessageAt: 500 })],
            []
        );
        expect(filterInboxConversations(withSale, 'all', 'ad-1')).toHaveLength(0);
    });
});

