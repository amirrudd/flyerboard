import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useSession } from "@descope/react-sdk";
import { MovingSaleFlow } from "../features/movingSale/MovingSaleFlow";
import { PageLoader } from "../components/PageLoader";
import { useFeatureFlag } from "../hooks/useFeatureFlag";
import type { Id } from "../../convex/_generated/dataModel";

export function MovingSalePage() {
  const navigate = useNavigate();
  const { isAuthenticated, isSessionLoading } = useSession();
  const [params] = useSearchParams();
  const saleParam = params.get("sale");
  const movingSaleModeEnabled = useFeatureFlag("movingSaleMode");

  useEffect(() => {
    if (!isSessionLoading && !isAuthenticated) {
      void navigate("/", { replace: true });
    }
  }, [isAuthenticated, isSessionLoading, navigate]);

  // Safety net for direct/bookmarked navigation while the feature is off —
  // the PostAd entry point already hides the tile that links here.
  useEffect(() => {
    if (movingSaleModeEnabled === false) {
      void navigate("/", { replace: true });
    }
  }, [movingSaleModeEnabled, navigate]);

  if (isSessionLoading || !isAuthenticated || movingSaleModeEnabled === undefined) {
    return <PageLoader />;
  }
  if (movingSaleModeEnabled === false) {
    return <PageLoader />;
  }

  return (
    <MovingSaleFlow
      initialSaleId={saleParam ? (saleParam as Id<"saleEvents">) : null}
    />
  );
}

export default MovingSalePage;
