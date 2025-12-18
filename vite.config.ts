import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import viteCompression from "vite-plugin-compression";

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    viteCompression(),
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
