import { Toaster } from "sonner";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./features/layout/Layout";
import { HomePage } from "./pages/HomePage";
import { AdDetailPage } from "./pages/AdDetailPage";
import { PostAdPage } from "./pages/PostAdPage";
import { DashboardPage } from "./pages/DashboardPage";
import { TermsPage } from "./pages/TermsPage";
import { CommunityGuidelinesPage } from "./pages/CommunityGuidelinesPage";
import { SupportPage } from "./pages/SupportPage";
import { MarketplaceProvider } from "./context/MarketplaceContext";

import { SpeedInsights } from "@vercel/speed-insights/react";

export default function App() {
  return (
    <MarketplaceProvider>
      <BrowserRouter>
        <SpeedInsights />
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/ad/:id" element={<AdDetailPage />} />
            <Route path="/post" element={<PostAdPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/community-guidelines" element={<CommunityGuidelinesPage />} />
            <Route path="/support" element={<SupportPage />} />
            {/* Add other routes as needed */}
          </Route>
        </Routes>
        <Toaster />
      </BrowserRouter>
    </MarketplaceProvider>
  );
}
