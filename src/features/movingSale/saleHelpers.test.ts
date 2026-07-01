import { describe, it, expect } from 'vitest';
import {
    formatAUD,
    isPlaceholderTitle,
    itemConfidence,
    getPickupPresets,
} from './saleHelpers';

describe('formatAUD', () => {
    it('formats a number as AUD with thousands separators and no decimals', () => {
        expect(formatAUD(1240)).toBe('$1,240');
    });

    it('rounds to the nearest dollar', () => {
        expect(formatAUD(1240.6)).toBe('$1,241');
    });

    it('formats zero as "$0"', () => {
        expect(formatAUD(0)).toBe('$0');
    });

    it('returns the em dash for undefined', () => {
        expect(formatAUD(undefined)).toBe('—');
    });

    it('returns the em dash for null', () => {
        expect(formatAUD(null)).toBe('—');
    });
});

describe('isPlaceholderTitle', () => {
    it('treats "Item N" placeholders as placeholders', () => {
        expect(isPlaceholderTitle('Item 3')).toBe(true);
        expect(isPlaceholderTitle('Item 12')).toBe(true);
    });

    it('treats real titles as non-placeholders', () => {
        expect(isPlaceholderTitle('Sofa')).toBe(false);
        expect(isPlaceholderTitle('Item Sofa')).toBe(false);
    });

    it('trims surrounding whitespace before matching', () => {
        expect(isPlaceholderTitle('  Item 5  ')).toBe(true);
    });
});

describe('itemConfidence', () => {
    it('returns "high" when a real title and a price are present', () => {
        expect(itemConfidence({ title: 'Sofa', price: 200 })).toBe('high');
    });

    it('returns "medium" when only the title is present', () => {
        expect(itemConfidence({ title: 'Sofa' })).toBe('medium');
        expect(itemConfidence({ title: 'Sofa', price: null })).toBe('medium');
    });

    it('returns "medium" when only the price is present', () => {
        expect(itemConfidence({ title: 'Item 3', price: 50 })).toBe('medium');
    });

    it('returns "low" when neither a real title nor a price is present', () => {
        expect(itemConfidence({ title: 'Item 3' })).toBe('low');
        expect(itemConfidence({ title: '', price: 0 })).toBe('low');
    });
});

describe('getPickupPresets', () => {
    it('returns exactly 3 presets', () => {
        expect(getPickupPresets()).toHaveLength(3);
    });

    it('returns presets whose end is after their start', () => {
        for (const preset of getPickupPresets()) {
            expect(preset.end).toBeGreaterThan(preset.start);
        }
    });

    it('puts the first preset start in the future', () => {
        const now = Date.now();
        expect(getPickupPresets()[0].start).toBeGreaterThan(now);
    });

    it('is deterministic relative to a provided `from` date', () => {
        // Wed 1 Jul 2026, midday.
        const from = new Date(2026, 6, 1, 12, 0, 0);
        const presets = getPickupPresets(from);
        const ids = presets.map((p) => p.id);
        expect(ids).toEqual(['this-sat', 'this-sun', 'next-sat']);
        // Every preset is in the future relative to `from`.
        for (const preset of presets) {
            expect(preset.start).toBeGreaterThan(from.getTime());
        }
    });
});
