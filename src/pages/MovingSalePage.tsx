import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useSession } from "@descope/react-sdk";
import { MovingSaleFlow } from "../features/movingSale/MovingSaleFlow";
import { PageLoader } from "../components/PageLoader";
import type { Id } from "../../convex/_generated/dataModel";

export function MovingSalePage() {
  const navigate = useNavigate();
  const { isAuthenticated, isSessionLoading } = useSession();
  const [params] = useSearchParams();
  const saleParam = params.get("sale");

  useEffect(() => {
    if (!isSessionLoading && !isAuthenticated) {
      void navigate("/", { replace: true });
    }
  }, [isAuthenticated, isSessionLoading, navigate]);

  if (isSessionLoading || !isAuthenticated) {
    return <PageLoader />;
  }

  return (
    <MovingSaleFlow
      initialSaleId={saleParam ? (saleParam as Id<"saleEvents">) : null}
    />
  );
}

export default MovingSalePage;
