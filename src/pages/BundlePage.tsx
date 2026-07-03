import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useSession } from "@descope/react-sdk";
import { BundleFlow } from "../features/bundles/BundleFlow";
import { PageLoader } from "../components/PageLoader";
import { useFeatureFlag } from "../hooks/useFeatureFlag";

export function BundlePage() {
  const navigate = useNavigate();
  const { isAuthenticated, isSessionLoading } = useSession();
  const [params] = useSearchParams();
  const preselect = params.get("preselect");
  const bundleModeEnabled = useFeatureFlag("bundleListing");

  useEffect(() => {
    if (!isSessionLoading && !isAuthenticated) {
      void navigate("/", { replace: true });
    }
  }, [isAuthenticated, isSessionLoading, navigate]);

  // Safety net for direct/bookmarked navigation while the feature is off —
  // the dashboard entry points already hide the buttons that link here.
  useEffect(() => {
    if (bundleModeEnabled === false) {
      void navigate("/", { replace: true });
    }
  }, [bundleModeEnabled, navigate]);

  // Covers loading, off, and not-yet-known — the effect above handles the
  // redirect for the "off" case once the flag resolves.
  if (isSessionLoading || !isAuthenticated || bundleModeEnabled !== true) {
    return <PageLoader />;
  }

  return <BundleFlow preselectAdId={preselect ?? undefined} />;
}

export default BundlePage;
