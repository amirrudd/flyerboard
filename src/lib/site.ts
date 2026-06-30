// Canonical site identity. Kept dependency-free (no DOM/Node APIs) so it can be
// imported from BOTH the browser bundle and vite.config.ts at build time — the
// same constraint frontmatter.ts satisfies. Single source of truth for the
// production origin used in canonical URLs, OG tags, JSON-LD, sitemap & llms.txt.
export const SITE_URL = "https://flyerboard.com.au";

export const postUrl = (slug: string): string => `${SITE_URL}/blog/${slug}`;
