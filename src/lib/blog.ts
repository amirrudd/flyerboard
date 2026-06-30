// Blog content loader.
//
// Posts are markdown files in src/content/blog/*.md with YAML frontmatter (see
// docs/guides/blog-content-guideline.md). They're bundled at build time via
// import.meta.glob, so dropping a new .md file in that folder publishes a post —
// no backend, no Convex table. Ordering is newest-first to match the rest of the
// app (see the "feed always newest-first" product rule).

import { format } from "date-fns";
import { parseFrontmatter } from "./frontmatter";

export interface BlogPost {
    title: string;
    description: string;
    slug: string;
    /** ISO date (YYYY-MM-DD) the post was first published. */
    date: string;
    /** ISO date of the last meaningful revision, if any (freshness signal). */
    updated?: string;
    author: string;
    category: string;
    keywords: string[];
    /** Minutes; taken from frontmatter or estimated at ~225 wpm. */
    readingTime: number;
    /** Optional editorial cover image — a path under /public or an absolute URL. */
    heroImage?: string;
    /** Alt text for the cover image; falls back to the title at render time. */
    heroAlt?: string;
    /** Markdown body with frontmatter stripped. */
    content: string;
}

const WORDS_PER_MINUTE = 225;

const modules = import.meta.glob("../content/blog/*.md", {
    eager: true,
    query: "?raw",
    import: "default",
});

function asString(value: string | string[] | undefined): string | undefined {
    return typeof value === "string" ? value : undefined;
}

function buildPost(path: string, raw: string): BlogPost {
    const { data, content } = parseFrontmatter(raw);
    const fileSlug = (path.split("/").pop() ?? "").replace(/\.md$/, "");
    const slug = asString(data.slug) || fileSlug;

    const wordCount = content.split(/\s+/).filter(Boolean).length;
    const declaredReadingTime = Number(asString(data.readingTime));
    const readingTime = Number.isFinite(declaredReadingTime) && declaredReadingTime > 0
        ? declaredReadingTime
        : Math.max(1, Math.round(wordCount / WORDS_PER_MINUTE));

    const singleKeyword = asString(data.keywords);
    const keywords = Array.isArray(data.keywords)
        ? data.keywords
        : singleKeyword
            ? [singleKeyword]
            : [];

    return {
        title: asString(data.title) ?? slug,
        description: asString(data.description) ?? "",
        slug,
        date: asString(data.date) ?? "",
        updated: asString(data.updated),
        author: asString(data.author) ?? "FlyerBoard Team",
        category: asString(data.category) ?? "Guides",
        keywords,
        readingTime,
        heroImage: asString(data.heroImage),
        heroAlt: asString(data.heroAlt),
        content,
    };
}

const posts: BlogPost[] = Object.entries(modules)
    .map(([path, raw]) => buildPost(path, raw))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

export function getAllPosts(): BlogPost[] {
    return posts;
}

export function getPostBySlug(slug: string): BlogPost | undefined {
    return posts.find((post) => post.slug === slug);
}

/**
 * Posts to suggest after `slug` — same category first, then the rest, newest
 * order preserved, current post excluded. Keeps readers moving to a next post.
 */
export function getRelatedPosts(slug: string, limit = 3): BlogPost[] {
    const current = getPostBySlug(slug);
    const others = posts.filter((post) => post.slug !== slug);
    if (!current) return others.slice(0, limit);
    const sameCategory = others.filter((post) => post.category === current.category);
    const rest = others.filter((post) => post.category !== current.category);
    return [...sameCategory, ...rest].slice(0, limit);
}

/** Formats an ISO post date; falls back to the raw string if unparseable. */
export function formatBlogDate(date: string, pattern = "d MMM yyyy"): string {
    if (!date) return "";
    const parsed = new Date(date);
    return Number.isNaN(parsed.getTime()) ? date : format(parsed, pattern);
}
