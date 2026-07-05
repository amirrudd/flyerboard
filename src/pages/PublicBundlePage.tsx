import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "convex/react";
import { CaretLeft, Package } from "@phosphor-icons/react";
import { api } from "../../convex/_generated/api";
import { PageLoader } from "../components/PageLoader";
import { useHeaderSlots } from "../features/layout/HeaderSlots";
import { ThemeToggle } from "../components/ThemeToggle";
import { PublicBundleView } from "../features/bundles/PublicBundleView";
import { BundleMessageModal } from "../features/bundles/BundleMessageModal";
import { useFeatureFlag } from "../hooks/useFeatureFlag";
import { sharePage } from "../lib/share";

/**
 * Public bundle detail page (`/bundle/:id`) — bundle v2. Mirrors
 * PublicSalePage's shell: header slots, friendly empty state, and a
 * message modal for the bundle-level thread.
 */
export function PublicBundlePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const bundle = useQuery(
    api.bundles.getPublicBundle,
    // Raw URL param — getPublicBundle takes a string and normalizes it, so a
    // malformed share link renders the friendly empty state instead of throwing.
    id ? { bundleId: id } : "skip"
  );
  const bundleListingEnabled = useFeatureFlag("bundleListing");
  const [msgOpen, setMsgOpen] = useState(false);

  // Single-purpose, link-shareable page — a way back, the wordmark, and the
  // theme toggle. Same header treatment as the public sale page.
  useHeaderSlots({
    leftNode: (
      <button
        type="button"
        onClick={() => { void navigate("/"); }}
        className="flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
      >
        <CaretLeft className="h-5 w-5" />
        <span className="hidden sm:inline">Back to flyers</span>
      </button>
    ),
    centerNode: (
      <button
        type="button"
        onClick={() => { void navigate("/"); }}
        className="cursor-pointer font-display text-xl font-semibold tracking-[-0.02em] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full"
      >
        FlyerBoard
      </button>
    ),
    rightNode: <ThemeToggle />,
  });

  if (bundle === undefined || bundleListingEnabled === undefined) return <PageLoader />;

  // Missing, deleted, cancelled, Sale-scoped, or the feature is currently
  // disabled → same friendly empty state as an expired sale link.
  if (bundle === null || bundleListingEnabled === false) {
    return (
      <div className="bg-background">
        <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <Package size={32} />
          </div>
          <h1 className="mt-4 font-display text-2xl font-semibold text-foreground">
            This bundle isn't available
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            The link may be wrong, or the seller has broken up the bundle.
          </p>
          <button
            type="button"
            onClick={() => { void navigate("/"); }}
            className="mt-6 rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground"
          >
            Browse FlyerBoard
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <PublicBundleView
        bundle={bundle}
        onMessageSeller={() => setMsgOpen(true)}
        onItemClick={(adId) => { void navigate(`/ad/${adId}`); }}
        onManage={() => { void navigate("/dashboard?tab=bundles"); }}
        onShare={() => { void sharePage(bundle.label); }}
      />
      <BundleMessageModal
        bundleId={bundle._id}
        sellerName={bundle.seller?.name ?? null}
        isOpen={msgOpen}
        onClose={() => setMsgOpen(false)}
      />
    </>
  );
}

export default PublicBundlePage;
