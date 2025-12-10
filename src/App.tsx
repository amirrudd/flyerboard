import { lazy, Suspense } from "react";
import { Toaster } from "sonner";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./features/layout/Layout";
// Eager: Critical for initial render
import { HomePage } from "./pages/HomePage";
import { MarketplaceProvider } from "./context/MarketplaceContext";
import { useDescopeUserSync } from "./lib/useDescopeUserSync";

import { SpeedInsights } from "@vercel/speed-insights/react";

// Lazy: Load on-demand when navigating to these routes
const AdDetailPage = lazy(() => import("./pages/AdDetailPage"));
const PostAdPage = lazy(() => import("./pages/PostAdPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const AdminDashboardPage = lazy(() => import("./pages/AdminDashboardPage"));
const TermsPage = lazy(() => import("./pages/TermsPage"));
const CommunityGuidelinesPage = lazy(() => import("./pages/CommunityGuidelinesPage"));
const SupportPage = lazy(() => import("./pages/SupportPage"));

// Loading fallback for lazy-loaded routes
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
  </div>
);

export default function App() {
  // Sync Descope user to Convex on authentication
  useDescopeUserSync();

  return (
    <MarketplaceProvider>
      <BrowserRouter>
        <SpeedInsights />
        <Routes>
          <Route element={<Layout />}>
            {/* Eager: Home is critical path */}
            <Route path="/" element={<HomePage />} />

            {/* Lazy: Only load when navigating to these routes */}
            <Route path="/ad/:id" element={
              <Suspense fallback={<PageLoader />}>
                <AdDetailPage />
              </Suspense>
            } />
            <Route path="/post" element={
              <Suspense fallback={<PageLoader />}>
                <PostAdPage />
              </Suspense>
            } />
            <Route path="/dashboard" element={
              <Suspense fallback={<PageLoader />}>
                <DashboardPage />
              </Suspense>
            } />
            <Route path="/admin" element={
              <Suspense fallback={<PageLoader />}>
                <AdminDashboardPage />
              </Suspense>
            } />
            <Route path="/terms" element={
              <Suspense fallback={<PageLoader />}>
                <TermsPage />
              </Suspense>
            } />
            <Route path="/community-guidelines" element={
              <Suspense fallback={<PageLoader />}>
                <CommunityGuidelinesPage />
              </Suspense>
            } />
            <Route path="/support" element={
              <Suspense fallback={<PageLoader />}>
                <SupportPage />
              </Suspense>
            } />
            {/* Add other routes as needed */}
          </Route>
        </Routes>
        <Toaster />
      </BrowserRouter>
    </MarketplaceProvider>
  );
}
