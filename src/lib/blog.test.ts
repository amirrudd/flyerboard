import { describe, it, expect } from "vitest";
import { getAllPosts, getPostBySlug } from "./blog";

describe("blog loader", () => {
    it("loads the published posts", () => {
        expect(getAllPosts().length).toBeGreaterThanOrEqual(3);
    });

    it("orders posts newest-first by date", () => {
        const dates = getAllPosts().map((p) => p.date);
        const sorted = [...dates].sort((a, b) => (a < b ? 1 : -1));
        expect(dates).toEqual(sorted);
    });

    it("gives every post the required fields", () => {
        for (const post of getAllPosts()) {
            expect(post.title).toBeTruthy();
            expect(post.description).toBeTruthy();
            expect(post.slug).toMatch(/^[a-z0-9-]+$/);
            expect(post.content.length).toBeGreaterThan(0);
            expect(post.readingTime).toBeGreaterThan(0);
            expect(Array.isArray(post.keywords)).toBe(true);
        }
    });

    it("looks a post up by slug, and returns undefined for unknown slugs", () => {
        const first = getAllPosts()[0];
        expect(getPostBySlug(first.slug)?.slug).toBe(first.slug);
        expect(getPostBySlug("no-such-post")).toBeUndefined();
    });
});
