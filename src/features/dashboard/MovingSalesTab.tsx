import { useQuery } from "convex/react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Package, Plus, ShareNetwork, ArrowRight } from "@phosphor-icons/react";
import { api } from "../../../convex/_generated/api";
import { ImageDisplay } from "../../components/ui/ImageDisplay";
import { AdListingSkeleton } from "../../components/ui/DashboardSkeleton";
import { formatAUD, formatPickupShort } from "../movingSale/saleHelpers";

const STATUS_META: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-amber-100 text-amber-700" },
  active: { label: "Live", className: "bg-emerald-100 text-emerald-700" },
  ended: { label: "Ended", className: "bg-muted text-muted-foreground" },
};

export function MovingSalesTab() {
  const navigate = useNavigate();
  const sales = useQuery(api.saleEvents.getMySaleEvents, {});

  async function shareSale(slug: string) {
    const url = `${window.location.origin}/sale/${slug}`;
    if (navigator.share) {
      try {
        await navigator.share({ url });
        return;
      } catch {
        /* cancelled */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy the link.");
    }
  }

  return (
    <section
      className="bg-card ring-1 ring-border/70 rounded-2xl shadow-card p-4 sm:p-6"
      aria-label="Moving sales"
    >
      <header className="mb-6 flex items-center justify-between gap-3">
        <div>
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Sell everything at once
          </span>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">
            Moving sales
          </h2>
        </div>
        <button
          type="button"
          onClick={() => { void navigate("/sell/moving-sale"); }}
          className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full bg-primary px-4 font-semibold text-primary-foreground shadow-sm shadow-primary/25 transition-all hover:bg-primary/90 active:scale-[0.98]"
        >
          <Plus size={18} weight="bold" /> New sale
        </button>
      </header>

      {sales === undefined ? (
        <div className="space-y-3">
          <AdListingSkeleton />
          <AdListingSkeleton />
        </div>
      ) : sales.length === 0 ? (
        <div className="flex flex-col items-center px-4 py-12 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Package size={32} weight="fill" />
          </div>
          <h3 className="mt-4 font-display text-lg font-semibold text-foreground">
            No moving sales yet
          </h3>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            Moving house? List everything in minutes — photos in, listings out, one
            shareable page.
          </p>
          <button
            type="button"
            onClick={() => { void navigate("/sell/moving-sale"); }}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground active:scale-[0.99]"
          >
            Start a moving sale <ArrowRight size={18} weight="bold" />
          </button>
        </div>
      ) : (
        <ul className="space-y-3">
          {sales.map((sale) => {
            const meta = STATUS_META[sale.status] ?? STATUS_META.draft;
            const live = sale.status === "active" && sale.slug;
            return (
              <li
                key={sale._id}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
              >
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-muted">
                  {sale.coverImage ? (
                    <ImageDisplay
                      imageRef={sale.coverImage}
                      alt={sale.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                      <Package size={24} />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold text-foreground">{sale.title}</p>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${meta.className}`}
                    >
                      {meta.label}
                    </span>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {sale.suburb} · {formatPickupShort(sale.pickupWindowStart)}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {sale.availableCount} available · {sale.soldCount} sold ·{" "}
                    {formatAUD(sale.totalValue)}
                  </p>
                </div>

                <div className="flex shrink-0 flex-col gap-1.5">
                  {live ? (
                    <>
                      <button
                        type="button"
                        onClick={() => { void navigate(`/sale/${sale.slug}`); }}
                        className="rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary active:scale-95"
                      >
                        View page
                      </button>
                      <button
                        type="button"
                        onClick={() => { if (sale.slug) void shareSale(sale.slug); }}
                        className="inline-flex items-center justify-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground active:scale-95"
                      >
                        <ShareNetwork size={14} /> Share
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { void navigate(`/sell/moving-sale?sale=${sale._id}`); }}
                      className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground active:scale-95"
                    >
                      Continue
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
