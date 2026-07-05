import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Package, X, Trash } from "@phosphor-icons/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { ImageDisplay } from "../../components/ui/ImageDisplay";
import { formatPrice } from "../../lib/priceFormatter";

interface BundleManageModalProps {
  bundleId: string;
  onClose: () => void;
}

export function BundleManageModal({ bundleId, onClose }: BundleManageModalProps) {
  const bundle = useQuery(api.bundles.getBundle, { bundleId: bundleId as Id<"saleBundles"> });
  const updateBundlePrice = useMutation(api.bundles.updateBundlePrice);
  const removeBundleItem = useMutation(api.bundles.removeBundleItem);
  const cancelBundle = useMutation(api.bundles.cancelBundle);
  const markBundleSold = useMutation(api.bundles.markBundleSold);

  const [priceInput, setPriceInput] = useState<string>("");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [busy, setBusy] = useState(false);
  const seeded = useRef(false);

  // Seed the price input once, when the bundle first loads (so clearing the
  // field afterwards doesn't get re-filled underneath the user).
  useEffect(() => {
    if (bundle && !seeded.current) {
      seeded.current = true;
      setPriceInput(String(bundle.bundlePrice));
    }
  }, [bundle]);

  const editable = bundle ? bundle.status === "active" || bundle.status === "partial" : false;
  const parsedPrice = Number(priceInput) || 0;
  const priceDirty = bundle ? parsedPrice > 0 && parsedPrice !== bundle.bundlePrice : false;

  async function handleSavePrice() {
    if (!priceDirty) return;
    setBusy(true);
    try {
      await updateBundlePrice({ bundleId: bundleId as Id<"saleBundles">, bundlePrice: parsedPrice });
      toast.success("Bundle price updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update the price");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(adId: string) {
    setBusy(true);
    try {
      const res = await removeBundleItem({
        bundleId: bundleId as Id<"saleBundles">,
        adId: adId as Id<"ads">,
      });
      if (res.status === "cancelled") {
        toast.success("Bundle broken up");
        onClose();
      } else {
        toast.success("Item removed from bundle");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't remove the item");
    } finally {
      setBusy(false);
    }
  }

  async function handleMarkSold() {
    setBusy(true);
    try {
      await markBundleSold({ bundleId: bundleId as Id<"saleBundles"> });
      toast.success("Bundle marked as sold");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't mark the bundle sold");
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel() {
    setBusy(true);
    try {
      await cancelBundle({ bundleId: bundleId as Id<"saleBundles"> });
      toast.success("Bundle cancelled");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't cancel the bundle");
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="bundle-manage-title"
    >
      <div
        className="bg-card ring-1 ring-border/70 rounded-2xl shadow-card-hover p-6 w-full max-w-md max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-bundle text-white">
              <Package size={18} weight="fill" />
            </span>
            <h2
              id="bundle-manage-title"
              className="font-display text-xl font-semibold tracking-tight text-foreground truncate"
            >
              {bundle?.label ?? "Bundle"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
          >
            <X size={18} />
          </button>
        </div>

        {bundle === undefined ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
        ) : bundle === null ? (
          <p className="py-8 text-center text-sm text-muted-foreground">This bundle is no longer available.</p>
        ) : (
          <>
            {bundle.status !== "active" && (
              <p className="mb-4 rounded-lg bg-bundle/10 px-3 py-2 text-xs font-medium text-bundle-emphasis">
                {bundle.status === "partial"
                  ? "An item sold individually — the bundle deal is no longer active."
                  : bundle.status === "sold"
                    ? "This bundle has been sold."
                    : "This bundle was cancelled."}
              </p>
            )}

            <ul className="space-y-2">
              {bundle.items.map((it) => (
                <li
                  key={it.adId}
                  className={`flex items-center gap-3 rounded-xl ring-1 ring-border/70 bg-card p-2 ${
                    it.isSold ? "opacity-50" : ""
                  }`}
                >
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg ring-1 ring-border/60">
                    {it.image ? (
                      <ImageDisplay imageRef={it.image} alt={it.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
                        <Package size={16} weight="light" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{it.title}</p>
                    <p className="text-xs tabular-nums text-muted-foreground">
                      {formatPrice(it.price)}
                      {it.isSold && " · Sold"}
                    </p>
                  </div>
                  {editable && !it.isSold && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => { void handleRemove(it.adId); }}
                      aria-label={`Remove ${it.title}`}
                      className="inline-flex items-center gap-1 rounded-full bg-muted/40 px-2.5 py-1.5 text-xs font-medium text-foreground ring-1 ring-border hover:bg-muted/70 disabled:opacity-40"
                    >
                      <Trash size={14} /> Remove
                    </button>
                  )}
                </li>
              ))}
            </ul>

            <dl className="mt-4 space-y-1 border-t border-border pt-3 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Separately</dt>
                <dd className="tabular-nums text-muted-foreground">{formatPrice(bundle.separatelyTotal)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-bundle-emphasis">Buyers save</dt>
                <dd className="font-semibold tabular-nums text-bundle-emphasis">
                  {formatPrice(bundle.savings)}
                </dd>
              </div>
            </dl>

            {editable && (
              <div className="mt-4">
                <label htmlFor="manage-bundle-price" className="block text-sm font-medium text-foreground">
                  Bundle price
                </label>
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="flex flex-1 items-center rounded-xl ring-1 ring-border focus-within:ring-2 focus-within:ring-bundle">
                    <span className="pl-3 text-base font-semibold text-muted-foreground">$</span>
                    <input
                      id="manage-bundle-price"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={priceInput}
                      onChange={(e) => setPriceInput(e.target.value)}
                      className="w-full rounded-xl bg-transparent px-2 py-2.5 text-base font-semibold tabular-nums text-foreground outline-none focus:ring-0! focus:border-transparent! [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={!priceDirty || busy}
                    onClick={() => { void handleSavePrice(); }}
                    className="inline-flex h-11 items-center justify-center rounded-xl bg-bundle px-4 text-sm font-semibold text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Save
                  </button>
                </div>
              </div>
            )}

            {bundle.status === "active" && (
              <button
                type="button"
                disabled={busy}
                onClick={() => { void handleMarkSold(); }}
                className="mt-5 w-full rounded-xl bg-bundle px-4 py-3 text-sm font-semibold text-white transition active:scale-[0.99] disabled:opacity-50"
              >
                Mark sold as a bundle
              </button>
            )}

            {bundle.status !== "sold" && bundle.status !== "cancelled" && (
              confirmCancel ? (
                <div className="mt-3 rounded-xl ring-1 ring-destructive/30 bg-destructive/5 p-3">
                  <p className="text-sm text-foreground">
                    Cancel this bundle? Items revert to standalone listings.
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmCancel(false)}
                      className="flex-1 rounded-full bg-muted/40 px-3 py-2 text-sm font-medium text-foreground ring-1 ring-border hover:bg-muted/70"
                    >
                      Keep bundle
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => { void handleCancel(); }}
                      className="flex-1 rounded-full bg-destructive px-3 py-2 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
                    >
                      Cancel bundle
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmCancel(true)}
                  className="mt-3 w-full rounded-xl px-4 py-3 text-sm font-semibold text-destructive transition hover:bg-destructive/5"
                >
                  Cancel bundle
                </button>
              )
            )}
          </>
        )}
      </div>
    </div>,
    document.body
  );
}

export default BundleManageModal;
