import { describe, it, expect } from "vitest";
import { parseFrontmatter } from "./frontmatter";

describe("parseFrontmatter", () => {
    it("parses flat key/value pairs and strips quotes", () => {
        const { data, content } = parseFrontmatter(
            `---\ntitle: "Hello World"\nauthor: FlyerBoard Team\n---\n# Body\n\nText here.`,
        );
        expect(data.title).toBe("Hello World");
        expect(data.author).toBe("FlyerBoard Team");
        expect(content).toBe("# Body\n\nText here.");
    });

    it("parses inline arrays into string[]", () => {
        const { data } = parseFrontmatter(`---\nkeywords: [scams, "online safety", Australia]\n---\nbody`);
        expect(data.keywords).toEqual(["scams", "online safety", "Australia"]);
    });

    it("returns empty data and trimmed content when no frontmatter is present", () => {
        const { data, content } = parseFrontmatter(`\n# Just a body\n`);
        expect(data).toEqual({});
        expect(content).toBe("# Just a body");
    });

    it("handles CRLF line endings", () => {
        const { data } = parseFrontmatter(`---\r\ntitle: Win\r\n---\r\nbody`);
        expect(data.title).toBe("Win");
    });

    it("ignores a leading UTF-8 BOM", () => {
        const { data } = parseFrontmatter(`﻿---\ntitle: BOM\n---\nbody`);
        expect(data.title).toBe("BOM");
    });
});
