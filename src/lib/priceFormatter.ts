/**
 * Formats a price value for display
 * @param price - The numeric price value
 * @param showCurrency - Whether to show the currency symbol (default: true)
 * @returns Formatted price string - "Free" for 0, otherwise "$X,XXX" or "$X,XXX AUD"
 */
export function formatPrice(price: number, showCurrency: boolean = true): string {
    if (price === 0) {
        return "Free";
    }

    if (showCurrency) {
        return `$${price.toLocaleString()}`;
    }

    return price.toLocaleString();
}

/**
 * Formats a price value with AUD suffix
 * @param price - The numeric price value
 * @returns Formatted price string - "Free" for 0, otherwise "$X,XXX AUD"
 */
export function formatPriceWithCurrency(price: number): string {
    if (price === 0) {
        return "Free";
    }

    return `$${price.toLocaleString()} AUD`;
}
