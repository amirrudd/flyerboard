import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import viteCompression from "vite-plugin-compression";
import { parseFrontmatter } from "./src/lib/frontmatter";
import { SITE_URL, postUrl } from "./src/lib/site";

// Emits /llms.txt and /sitemap.xml from the blog markdown at build time so the
// blog stays discoverable by AI crawlers and search engines without a manual
// step. Reads the same src/content/blog/*.md files the app bundles, so it can
// never drift from what's published. See docs/guides/blog-content-guideline.md.
function blogDiscoverabilityPlugin() {
  return {
    name: "flyerboard-blog-discoverability",
    apply: "build" as const,
    writeBundle(options: { dir?: string }) {
      try {
        const outDir = options.dir ?? path.resolve(__dirname, "dist");
        const blogDir = path.resolve(__dirname, "src/content/blog");
        const files = fs.existsSync(blogDir)
          ? fs.readdirSync(blogDir).filter((f) => f.endsWith(".md"))
          : [];

        const posts = files
          .map((file) => {
            const { data } = parseFrontmatter(fs.readFileSync(path.join(blogDir, file), "utf-8"));
            const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");
            const slug = str(data.slug) || file.replace(/\.md$/, "");
            return {
              slug,
              title: str(data.title) || slug,
              description: str(data.description),
              date: str(data.date),
              updated: str(data.updated) || str(data.date),
            };
          })
          .sort((a, b) => (a.date < b.date ? 1 : -1));

        const llms = [
          "# FlyerBoard",
          "",
          "> FlyerBoard is Australia's local classified marketplace — buy, sell, and trade safely in your community. Made in Melbourne, built around safety and reuse.",
          "",
          "## Blog",
          "Practical guides on buying and selling locally:",
          "",
          ...posts.map((p) => `- [${p.title}](${postUrl(p.slug)}): ${p.description}`),
          "",
        ].join("\n");
        fs.writeFileSync(path.join(outDir, "llms.txt"), llms);

        const staticPaths = ["/", "/blog", "/about", "/support", "/terms", "/community-guidelines"];
        const urls = [
          ...staticPaths.map((p) => ({ loc: `${SITE_URL}${p}`, lastmod: "" })),
          ...posts.map((p) => ({ loc: postUrl(p.slug), lastmod: p.updated })),
        ];
        const sitemap =
          `<?xml version="1.0" encoding="UTF-8"?>\n` +
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
          urls
            .map(
              (u) =>
                `  <url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}</url>`,
            )
            .join("\n") +
          `\n</urlset>\n`;
        fs.writeFileSync(path.join(outDir, "sitemap.xml"), sitemap);
      } catch (err) {
        console.warn("[flyerboard-blog-discoverability] skipped:", err);
      }
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    viteCompression(),
    blogDiscoverabilityPlugin(),
    // The code below enables dev tools like taking screenshots of your site
    // while it is being developed on chef.convex.dev.
    // Feel free to remove this code if you're no longer developing your app with Chef.
    mode === "development"
      ? {
        name: "inject-chef-dev",
        transform(code: string, id: string) {
          if (id.includes("main.tsx")) {
            return {
              code: `${code}

/* Added by Vite plugin inject-chef-dev */
window.addEventListener('message', async (message) => {
  if (message.source !== window.parent) return;
  if (message.data.type !== 'chefPreviewRequest') return;

  const worker = await import('https://chef.convex.dev/scripts/worker.bundled.mjs');
  await worker.respondToMessage(message);
});
            `,
              map: null,
            };
          }
          return null;
        },
      }
      : null,
    // End of code for taking screenshots on chef.convex.dev.
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Stub out Node.js built-ins that are imported by server-only packages
      // These should never be used in the browser
      "http": "vite/module-empty",
      "https": "vite/module-empty",
      "net": "vite/module-empty",
      "tls": "vite/module-empty",
      "crypto": "vite/module-empty",
      "stream": "vite/module-empty",
      "url": "vite/module-empty",
      "util": "vite/module-empty",
      "assert": "vite/module-empty",
      "buffer": "vite/module-empty",
    },
  },
  optimizeDeps: {
    exclude: [
      "@convex-dev/resend",
      "agent-base",
      "https-proxy-agent"
    ],
  },
  build: {
    chunkSizeWarningLimit: 1000,
  },
}));
