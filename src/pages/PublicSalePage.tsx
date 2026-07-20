import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSession } from "@descope/react-sdk";
import { useQuery, useMutation } from "convex/react";
import { useUserSync } from "../context/UserSyncContext";
import { toast } from "sonner";
import { CaretLeft, Package } from "@phosphor-icons/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { PageLoader } from "../components/PageLoader";
import { useHeaderSlots } from "../features/layout/HeaderSlots";
import { ThemeToggle } from "../components/ThemeToggle";
import { PublicSaleView } from "../features/movingSale/PublicSaleView";
import { PublicSaleViewEditorial } from "../features/movingSale/PublicSaleViewEditorial";
import { useSaleDesignVariant, getUrlVariantOverride } from "../features/movingSale/useSaleDesignVariant";
import { SaleMessageModal } from "../features/movingSale/SaleMessageModal";
import type { SaleItem } from "../features/movingSale/types";
import { useFeatureFlag } from "../hooks/useFeatureFlag";
import { sharePage } from "../lib/share";

export function PublicSalePage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const data = useQuery(api.saleEvents.getSaleBySlug, slug ? { slug } : "skip");
  // Owner check only — gate on the canonical auth+sync flags so anonymous
  // visitors (the common case for a shared sale link) skip the query entirely.
  const { isAuthenticated, isSessionLoading } = useSession();
  const { isUserSynced } = useUserSync();
  const authReady = isAuthenticated && !isSessionLoading && isUserSynced;
  const me = useQuery(api.descopeAuth.getCurrentUser, authReady ? {} : "skip");
  const setItemSold = useMutation(api.saleEvents.setItemSold);
  const movingSaleModeEnabled = useFeatureFlag("movingSaleMode");
  const [msgOpen, setMsgOpen] = useState(false);
  const [preselectedAdId, setPreselectedAdId] = useState<Id<"ads"> | null>(null);
  const designVariant = useSaleDesignVariant();
  // Admin config toggle (Admin > Feature Flags): force everyone to Variant B,
  // e.g. once it's declared the winner. `?variant=` in the URL still wins for
  // QA/demoing the other design regardless of the flag.
  const forceVariantB = useQuery(api.featureFlags.getFeatureFlag, { key: "movingSaleDesignForceB" });
  const effectiveVariant = getUrlVariantOverride() ?? (forceVariantB ? "B" : designVariant);

  const categoriesById = useMemo(() => {
    const map: Record<string, { name: string }> = {};
    for (const c of data?.categories ?? []) map[c._id] = { name: c.name };
    return map;
  }, [data]);

  // No search/location bar or post/sign-in actions on this single-purpose,
  // link-shared page — just a way back and the theme toggle it was missing.
  // Registered on the persistent Layout header (config rebuilt every render).
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

  if (data === undefined || movingSaleModeEnabled === undefined) return <PageLoader />;

  // Not found, not paid, expired, or the feature is currently disabled
  // (Admin > Feature Flags > movingSaleMode) → same friendly empty state.
  if (data === null || movingSaleModeEnabled === false) {
    return (
      <div className="bg-background">
        <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <Package size={32} />
          </div>
          <h1 className="mt-4 font-display text-2xl font-semibold text-foreground">
            This sale isn't available
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            The link may be wrong, or the sale has ended.
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

  const items = data.items as SaleItem[];

  /** v2: one sale-level conversation per buyer — open the unified message thread. */
  function messageSeller() {
    setPreselectedAdId(null);
    setMsgOpen(true);
  }

  /** Tapping an item opens the same thread with that item pre-referenced as a chip. */
  function openItem(adId: string) {
    setPreselectedAdId(adId as Id<"ads">);
    setMsgOpen(true);
  }

  // Ended sale: read-only record — badge swaps, countdown becomes a note, the
  // message/save footer disappears, item taps do nothing.
  const ended = data.sale.status === "ended";

  // Owner viewing their own live sale: item taps toggle sold/unsold instead of
  // opening the (self-)message modal.
  const isOwner = !ended && !!me && !!data.seller && me._id === data.seller._id;

  function toggleItemSold(adId: string) {
    const item = items.find((i) => i._id === adId);
    if (!item) return;
    setItemSold({ adId: adId as Id<"ads">, isSold: !item.isSold })
      .then(() => toast.success(item.isSold ? "Marked as available" : "Marked as sold"))
      .catch(() => toast.error("Couldn't update item"));
  }


  return (
    <div className="min-h-[100dvh] bg-background pb-6">
      {effectiveVariant === "B" ? (
        <PublicSaleViewEditorial
          sale={data.sale}
          sellerName={data.seller?.name ?? null}
          sellerImage={data.seller?.image}
          sellerVerified={data.seller?.isVerified}
          items={items}
          bundles={data.bundles}
          categoriesById={categoriesById}
          ended={ended}
          onMessageSeller={ended ? undefined : messageSeller}
          onItemClick={ended ? undefined : openItem}
          onToggleSold={isOwner ? toggleItemSold : undefined}
          onShare={() => { void sharePage(data.sale.title); }}
        />
      ) : (
        <PublicSaleView
          sale={data.sale}
          sellerName={data.seller?.name ?? null}
          sellerImage={data.seller?.image}
          items={items}
          bundles={data.bundles}
          categoriesById={categoriesById}
          ended={ended}
          onMessageSeller={ended ? undefined : messageSeller}
          onItemClick={ended ? undefined : openItem}
          onToggleSold={isOwner ? toggleItemSold : undefined}
          onShare={() => { void sharePage(data.sale.title); }}
        />
      )}
      <SaleMessageModal
        saleEventId={data.sale._id}
        sellerName={data.seller?.name ?? null}
        items={items}
        isOpen={msgOpen}
        preselectedAdId={preselectedAdId}
        onClose={() => setMsgOpen(false)}
      />
    </div>
  );
}

export default PublicSalePage;
