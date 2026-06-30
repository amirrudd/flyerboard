import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "convex/react";
import { toast } from "sonner";
import { Package } from "@phosphor-icons/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { PageLoader } from "../components/PageLoader";
import { PublicSaleView } from "../features/movingSale/PublicSaleView";
import { SaleMessageModal } from "../features/movingSale/SaleMessageModal";
import type { SaleItem } from "../features/movingSale/types";

export function PublicSalePage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const data = useQuery(api.saleEvents.getSaleBySlug, slug ? { slug } : "skip");
  const [msgOpen, setMsgOpen] = useState(false);
  const [preselectedAdId, setPreselectedAdId] = useState<Id<"ads"> | null>(null);

  const categoriesById = useMemo(() => {
    const map: Record<string, { name: string }> = {};
    for (const c of data?.categories ?? []) map[c._id] = { name: c.name };
    return map;
  }, [data]);

  if (data === undefined) return <PageLoader />;

  // Not found, not paid, or expired → friendly empty state.
  if (data === null) {
    return (
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

  async function shareSale() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: data!.sale.title, url });
      } catch {
        /* cancelled */
      }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied");
      } catch {
        toast.error("Couldn't copy the link.");
      }
    }
  }

  return (
    <div className="min-h-[100dvh] bg-background pb-6">
      <PublicSaleView
        sale={data.sale}
        sellerName={data.seller?.name ?? null}
        sellerImage={data.seller?.image}
        items={items}
        bundles={data.bundles}
        categoriesById={categoriesById}
        onMessageSeller={messageSeller}
        onItemClick={openItem}
        onShare={() => { void shareSale(); }}
      />
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
