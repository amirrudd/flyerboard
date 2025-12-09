import { createRoot } from "react-dom/client";
import { AuthProvider } from "@descope/react-sdk";
import { ConvexProviderWithAuth } from "convex/react";
import { ConvexReactClient } from "convex/react";
import { useDescopeAuth } from "./lib/useDescopeAuth";
import "./index.css";
import App from "./App";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

createRoot(document.getElementById("root")!).render(
  <AuthProvider
    projectId={import.meta.env.VITE_DESCOPE_PROJECT_ID as string}
    persistTokens={true}
    autoRefresh={true}
    sessionTokenViaCookie={false}
  >
    <ConvexProviderWithAuth client={convex} useAuth={useDescopeAuth}>
      <App />
    </ConvexProviderWithAuth>
  </AuthProvider>,
);
