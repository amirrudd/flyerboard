import { Toaster } from "sonner";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./features/layout/Layout";
import { HomePage } from "./pages/HomePage";
import { AdDetailPage } from "./pages/AdDetailPage";
import { PostAdPage } from "./pages/PostAdPage";
import { DashboardPage } from "./pages/DashboardPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/ad/:id" element={<AdDetailPage />} />
          <Route path="/post" element={<PostAdPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          {/* Add other routes as needed */}
        </Route>
      </Routes>
      <Toaster />
    </BrowserRouter>
  );
}
