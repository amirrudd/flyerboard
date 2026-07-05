import { useState } from "react";
import { useQuery } from "convex/react";
import { useNavigate } from "react-router-dom";
import { Package, Plus, ArrowRight } from "@phosphor-icons/react";
import { api } from "../../../convex/_generated/api";
import { AdListingSkeleton } from "../../components/ui/DashboardSkeleton";
import { formatPrice } from "../../lib/priceFormatter";
import { BundleThumbnail } from "../bundles/BundleThumbnail";
import { BundleManageModal } from "../bundles/BundleManageModal";

const STATUS_META: Record<string, { label: string; className: string }> = {
  active: { label: "Live", className: "bg-emerald-100 text-emerald-700" },
  partial: { label: "Partial", className: "bg-amber-100 text-amber-700" },
  sold: { label: "Sold", className: "bg-muted text-muted-foreground" },
  cancelled: { label: "Cancelled", className: "bg-muted text-muted-foreground" },
};

/** A bundle's display name — its label, or the first two item titles. */
function bundleName(label: string | undefined, items: { title: string }[]): string {
  if (label && label.trim()) return label;
  return items.map((i) => i.title).slice(0, 2).join(" + ") || "Bundle";
}

/**
 * Dashboard "Bundles" section. Mirrors MovingSalesTab: its own query + header +
 * empty state + list. A bundle row opens the manage modal (edit price / remove /
 * mark sold / cancel) — the same modal reached from the per-ad "In bundle" tag.
 */
export function BundlesTab() {
  const navigate = useNavigate();
  const bundles = useQuery(api.bundles.getMyBundles, {});
  const [manageId, setManageId] = useState<string | null>(null);

  return (
    <section
      className="bg-card ring-1 ring-border/70 rounded-2xl shadow-card p-4 sm:p-6"
      aria-label="Bundles"
    >
      <header className="mb-6 flex items-center justify-between gap-3">
        <div>
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Package your listings
          </span>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">
            Bundles
          </h2>
        </div>
        <button
          type="button"
          onClick={() => { void navigate("/sell/bundle"); }}
          className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full bg-bundle px-4 font-semibold text-bundle-foreground shadow-sm shadow-bundle/25 transition-all hover:bg-bundle/90 active:scale-[0.98]"
        >
          <Plus size={18} weight="bold" /> New bundle
        </button>
      </header>

      {bundles === undefined ? (
        <div className="space-y-3">
          <AdListingSkeleton />
          <AdListingSkeleton />
        </div>
      ) : bundles.length === 0 ? (
        <div className="flex flex-col items-center px-4 py-12 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-bundle/10 text-bundle-emphasis">
            <Package size={32} weight="fill" />
          </div>
          <h3 className="mt-4 font-display text-lg font-semibold text-foreground">
            No bundles yet
          </h3>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            Group two to four of your listings at a package price — buyers get a
            better deal when they take the set.
          </p>
          <button
            type="button"
            onClick={() => { void navigate("/sell/bundle"); }}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-bundle px-5 py-3 font-semibold text-bundle-foreground active:scale-[0.99]"
          >
            Create a bundle <ArrowRight size={18} weight="bold" />
          </button>
        </div>
      ) : (
        <ul className="space-y-3">
          {bundles.map((bundle) => {
            const meta = STATUS_META[bundle.status] ?? STATUS_META.active;
            const covers = bundle.items.map((i) => i.image).filter((c): c is string => Boolean(c));
            return (
              <li
                key={bundle._id}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
              >
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-muted">
                  <BundleThumbnail covers={covers} itemCount={bundle.items.length} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold text-foreground">
                      {bundleName(bundle.label, bundle.items)}
                    </p>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${meta.className}`}
                    >
                      {meta.label}
                    </span>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {bundle.items.length} items
                    {bundle.savings > 0 && (
                      <> · <span className="text-bundle-emphasis">Save {formatPrice(bundle.savings)}</span></>
                    )}
                  </p>
                  <p className="mt-0.5 text-sm">
                    <span className="font-display font-semibold tabular-nums text-bundle-emphasis">
                      {formatPrice(bundle.bundlePrice)}
                    </span>
                    {bundle.savings > 0 && (
                      <span className="ml-2 text-xs tabular-nums text-muted-foreground line-through">
                        {formatPrice(bundle.separatelyTotal)}
                      </span>
                    )}
                  </p>
                </div>

                <div className="flex shrink-0 flex-col gap-1.5">
                  <button
                    type="button"
                    onClick={() => setManageId(bundle._id)}
                    className="rounded-lg bg-bundle/10 px-3 py-1.5 text-xs font-semibold text-bundle-emphasis active:scale-95"
                  >
                    Manage
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {manageId && (
        <BundleManageModal bundleId={manageId} onClose={() => setManageId(null)} />
      )}
    </section>
  );
}
