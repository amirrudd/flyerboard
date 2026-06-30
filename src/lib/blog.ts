// Blog content loader.
//
// Posts are markdown files in src/content/blog/*.md with YAML frontmatter (see
// docs/guides/blog-content-guideline.md). They're bundled at build time via
// import.meta.glob, so dropping a new .md file in that folder publishes a post —
// no backend, no Convex table. Ordering is newest-first to match the rest of the
// app (see the "feed always newest-first" product rule).

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

    const keywords = Array.isArray(data.keywords)
        ? data.keywords
        : asString(data.keywords)
            ? [asString(data.keywords) as string]
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
