import { createRoot } from "react-dom/client";
import { AuthProvider } from "@descope/react-sdk";
import { ConvexProviderWithAuth } from "convex/react";
import { ConvexReactClient } from "convex/react";
import { useDescopeAuth } from "./lib/useDescopeAuth";
import "./index.css";
import App from "./App";

// Validate required environment variables
const descopeProjectId = import.meta.env.VITE_DESCOPE_PROJECT_ID;
if (!descopeProjectId) {
  console.error(
    "❌ CRITICAL: Missing VITE_DESCOPE_PROJECT_ID environment variable. " +
    "Add it to Vercel environment variables and redeploy. " +
    "See .env.example for setup instructions."
  );
  // In development, throw to fail fast
  if (import.meta.env.DEV) {
    throw new Error("Missing VITE_DESCOPE_PROJECT_ID - check your .env.local file");
  }
}

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

createRoot(document.getElementById("root")!).render(
  <AuthProvider
    projectId={descopeProjectId || ""}
    persistTokens={true}
    autoRefresh={true}
    sessionTokenViaCookie={false}
  >
    <ConvexProviderWithAuth client={convex} useAuth={useDescopeAuth}>
      <App />
    </ConvexProviderWithAuth>
  </AuthProvider>,
);

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.error('Service worker registration failed:', error);
    });
  });
}
