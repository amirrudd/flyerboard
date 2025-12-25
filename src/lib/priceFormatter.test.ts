import { describe, it, expect } from 'vitest';
import { formatPrice, formatPriceWithCurrency } from './priceFormatter';

describe('priceFormatter', () => {
    describe('formatPrice', () => {
        it('should return "Free" for price of 0', () => {
            expect(formatPrice(0)).toBe('Free');
        });

        it('should format positive prices with currency symbol by default', () => {
            expect(formatPrice(100)).toBe('$100');
            expect(formatPrice(1000)).toBe('$1,000');
            expect(formatPrice(1000000)).toBe('$1,000,000');
        });

        it('should format decimal prices correctly', () => {
            expect(formatPrice(99.99)).toBe('$99.99');
            expect(formatPrice(1234.56)).toBe('$1,234.56');
        });

        it('should format prices without currency symbol when showCurrency is false', () => {
            expect(formatPrice(100, false)).toBe('100');
            expect(formatPrice(1000, false)).toBe('1,000');
        });

        it('should still return "Free" for 0 even when showCurrency is false', () => {
            expect(formatPrice(0, false)).toBe('Free');
        });
    });

    describe('formatPriceWithCurrency', () => {
        it('should return "Free" for price of 0', () => {
            expect(formatPriceWithCurrency(0)).toBe('Free');
        });

        it('should format positive prices with currency symbol and AUD suffix', () => {
            expect(formatPriceWithCurrency(100)).toBe('$100 AUD');
            expect(formatPriceWithCurrency(1000)).toBe('$1,000 AUD');
            expect(formatPriceWithCurrency(1000000)).toBe('$1,000,000 AUD');
        });

        it('should format decimal prices correctly with AUD suffix', () => {
            expect(formatPriceWithCurrency(99.99)).toBe('$99.99 AUD');
            expect(formatPriceWithCurrency(1234.56)).toBe('$1,234.56 AUD');
        });
    });
});
