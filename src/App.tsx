import { lazy, Suspense } from "react";
import { Toaster } from "sonner";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./features/layout/Layout";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { PageLoader } from "./components/PageLoader";
// Eager: Critical for initial render
import { HomePage } from "./pages/HomePage";
import { MarketplaceProvider } from "./context/MarketplaceContext";
import { UserSyncProvider } from "./context/UserSyncContext";

import { useSession } from "@descope/react-sdk";
import { SpeedInsights } from "@vercel/speed-insights/react";

// Lazy: Load on-demand when navigating to these routes
const AdDetailPage = lazy(() => import("./pages/AdDetailPage"));
const PostAdPage = lazy(() => import("./pages/PostAdPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const AdminDashboardPage = lazy(() => import("./pages/AdminDashboardPage"));
const TermsPage = lazy(() => import("./pages/TermsPage"));
const CommunityGuidelinesPage = lazy(() => import("./pages/CommunityGuidelinesPage"));
const SupportPage = lazy(() => import("./pages/SupportPage"));
const AboutUsPage = lazy(() => import("./pages/AboutUsPage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));
const MovingSalePage = lazy(() => import("./pages/MovingSalePage"));
const PublicSalePage = lazy(() => import("./pages/PublicSalePage"));
const BlogIndexPage = lazy(() => import("./pages/BlogIndexPage"));
const BlogPostPage = lazy(() => import("./pages/BlogPostPage"));

export default function App() {
  const { isSessionLoading } = useSession();

  if (isSessionLoading) {
    return <PageLoader />;
  }

  return (
    <ErrorBoundary>
      <UserSyncProvider>
        <MarketplaceProvider>
          <BrowserRouter>
            <SpeedInsights />
            <Routes>
              {/* Immersive seller flow — full screen, outside the app shell */}
              <Route path="/sell/moving-sale" element={
                <ErrorBoundary>
                  <Suspense fallback={<PageLoader />}>
                    <MovingSalePage />
                  </Suspense>
                </ErrorBoundary>
              } />
              <Route element={<Layout />}>
                {/* Eager: Home is critical path */}
                <Route path="/" element={<HomePage />} />

                {/* Lazy: Only load when navigating to these routes */}
                <Route path="/ad/:id" element={
                  <ErrorBoundary>
                    <Suspense fallback={<PageLoader />}>
                      <AdDetailPage />
                    </Suspense>
                  </ErrorBoundary>
                } />
                {/* Public buyer-facing moving sale page */}
                <Route path="/sale/:slug" element={
                  <ErrorBoundary>
                    <Suspense fallback={<PageLoader />}>
                      <PublicSalePage />
                    </Suspense>
                  </ErrorBoundary>
                } />
                <Route path="/post" element={
                  <ErrorBoundary>
                    <Suspense fallback={<PageLoader />}>
                      <PostAdPage />
                    </Suspense>
                  </ErrorBoundary>
                } />
                <Route path="/dashboard" element={
                  <ErrorBoundary>
                    <Suspense fallback={<PageLoader />}>
                      <DashboardPage />
                    </Suspense>
                  </ErrorBoundary>
                } />
                <Route path="/admin" element={
                  <ErrorBoundary>
                    <Suspense fallback={<PageLoader />}>
                      <AdminDashboardPage />
                    </Suspense>
                  </ErrorBoundary>
                } />
                <Route path="/terms" element={
                  <ErrorBoundary>
                    <Suspense fallback={<PageLoader />}>
                      <TermsPage />
                    </Suspense>
                  </ErrorBoundary>
                } />
                <Route path="/community-guidelines" element={
                  <ErrorBoundary>
                    <Suspense fallback={<PageLoader />}>
                      <CommunityGuidelinesPage />
                    </Suspense>
                  </ErrorBoundary>
                } />
                <Route path="/support" element={
                  <ErrorBoundary>
                    <Suspense fallback={<PageLoader />}>
                      <SupportPage />
                    </Suspense>
                  </ErrorBoundary>
                } />
                <Route path="/about" element={
                  <ErrorBoundary>
                    <Suspense fallback={<PageLoader />}>
                      <AboutUsPage />
                    </Suspense>
                  </ErrorBoundary>
                } />
                <Route path="/blog" element={
                  <ErrorBoundary>
                    <Suspense fallback={<PageLoader />}>
                      <BlogIndexPage />
                    </Suspense>
                  </ErrorBoundary>
                } />
                <Route path="/blog/:slug" element={
                  <ErrorBoundary>
                    <Suspense fallback={<PageLoader />}>
                      <BlogPostPage />
                    </Suspense>
                  </ErrorBoundary>
                } />
                {/* Catch-all: any unknown URL renders the branded 404. */}
                <Route path="*" element={
                  <ErrorBoundary>
                    <Suspense fallback={<PageLoader />}>
                      <NotFoundPage />
                    </Suspense>
                  </ErrorBoundary>
                } />
              </Route>
            </Routes>
            <Toaster />
          </BrowserRouter>
        </MarketplaceProvider>
      </UserSyncProvider>
    </ErrorBoundary>
  );
}
