import { useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { CircleNotch, RocketLaunch, Check } from "@phosphor-icons/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { PublicSaleView } from "../PublicSaleView";
import type { SaleBundle, SaleEventCore, SaleItem } from "../types";

interface PublishStepProps {
  saleEventId: Id<"saleEvents">;
  sale: SaleEventCore;
  sellerName: string | null;
  items: SaleItem[];
  bundles: SaleBundle[];
  categoriesById: Record<string, { name: string }>;
  itemCount: number;
  bundleCount: number;
  onPublished: (slug: string) => void;
  onBack: () => void;
}

/**
 * v2: publishing is FREE. This is a final confirmation + live preview, not a
 * paywall — the seller sees exactly what buyers will see, then publishes for free.
 * Paid add-ons are offered afterwards on the share screen, never as a gate.
 */
export function PublishStep({
  saleEventId,
  sale,
  sellerName,
  items,
  bundles,
  categoriesById,
  itemCount,
  bundleCount,
  onPublished,
  onBack,
}: PublishStepProps) {
  const publish = useMutation(api.saleEvents.publishSaleEvent);
  const [publishing, setPublishing] = useState(false);

  async function handlePublish() {
    setPublishing(true);
    try {
      const { slug } = await publish({ saleEventId });
      onPublished(slug);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't publish your sale.");
      setPublishing(false);
    }
  }

  return (
    <div className="relative mx-auto w-full max-w-md pb-40">
      <div className="px-4 pt-6 text-center">
        <h2 className="font-display text-2xl font-semibold text-foreground">
          Ready to go live
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {itemCount} items{bundleCount > 0 ? ` · ${bundleCount} bundles` : ""}. This is
          exactly what buyers will see — publishing is free.
        </p>
      </div>

      {/* Full, un-blurred live preview */}
      <div className="relative mt-4 max-h-[55vh] overflow-hidden rounded-2xl border border-border">
        <PublicSaleView
          sale={sale}
          sellerName={sellerName}
          items={items}
          bundles={bundles}
          categoriesById={categoriesById}
          preview
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-card to-transparent" />
      </div>

      {/* Sticky free-publish CTA */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur"
        style={{ paddingBottom: "var(--safe-area-inset-bottom)" }}
      >
        <div className="mx-auto max-w-md px-4 py-3">
          <div className="mb-2 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <Check size={13} weight="bold" className="text-emerald-600" />
            Free · permanent shareable link · live immediately
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onBack}
              className="rounded-xl border border-border bg-card px-3 py-3.5 text-sm font-medium text-foreground"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => { void handlePublish(); }}
              disabled={publishing}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 font-semibold text-primary-foreground transition active:scale-[0.99] disabled:opacity-60"
            >
              {publishing ? (
                <CircleNotch size={18} className="animate-spin" />
              ) : (
                <RocketLaunch size={18} weight="fill" />
              )}
              Publish my sale — free
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
