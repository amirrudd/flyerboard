export function slugify(text: string): string {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')        // Replace spaces with -
        .replace(/[^\w\-]+/g, '')    // Remove all non-word chars
        .replace(/\-\-+/g, '-')      // Replace multiple - with single -
        .replace(/^-+/, '')          // Trim - from start of text
        .replace(/-+$/, '');         // Trim - from end of text
}

export function generateAdUrl(ad: any, categorySlug: string): string {
    const locationSlug = slugify(ad.location);
    const titleSlug = slugify(ad.title);
    // Hybrid URL: /location/category/title-id
    return `/${locationSlug}/${categorySlug}/${titleSlug}-${ad._id}`;
}

export function extractIdFromSlug(slugId: string): string {
    // Extract the ID from the end of the slug (everything after the last hyphen)
    const parts = slugId.split('-');
    return parts[parts.length - 1];
}
