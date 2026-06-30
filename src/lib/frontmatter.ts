// Tiny, dependency-free YAML-frontmatter parser.
//
// Why hand-rolled: the blog only needs flat `key: value` pairs and simple
// `key: [a, b]` arrays (see docs/guides/blog-content-guideline.md). Pulling in
// gray-matter would add a Buffer/Node dependency that doesn't belong in the
// browser bundle. This module is intentionally pure (no Node/DOM APIs) so it can
// be imported from BOTH the browser loader (src/lib/blog.ts) and the build-time
// llms.txt / sitemap generator (vite.config.ts).

export interface ParsedMarkdown {
    data: Record<string, string | string[]>;
    content: string;
}

function stripQuotes(value: string): string {
    if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
    ) {
        return value.slice(1, -1);
    }
    return value;
}

export function parseFrontmatter(raw: string): ParsedMarkdown {
    const normalized = raw.replace(/^\uFEFF/, "");
    const match = /^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?/.exec(normalized);
    if (!match) {
        return { data: {}, content: normalized.trim() };
    }

    const data: Record<string, string | string[]> = {};
    for (const line of match[1].split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const sep = trimmed.indexOf(":");
        if (sep === -1) continue;
        const key = trimmed.slice(0, sep).trim();
        if (!key) continue;
        const value = trimmed.slice(sep + 1).trim();

        if (value.startsWith("[") && value.endsWith("]")) {
            data[key] = value
                .slice(1, -1)
                .split(",")
                .map((item) => stripQuotes(item.trim()))
                .filter(Boolean);
        } else {
            data[key] = stripQuotes(value);
        }
    }

    return { data, content: normalized.slice(match[0].length).trim() };
}
