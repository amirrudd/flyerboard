import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { motion, useAnimation } from "framer-motion";
import {
  MapPin,
  Package,
  ShareNetwork,
  BookmarkSimple,
  ChatCircle,
  Clock,
} from "@phosphor-icons/react";
import { ImageDisplay } from "../../components/ui/ImageDisplay";
import { useMotionPrefs } from "../../hooks/useMotionPrefs";
import { useCountdown } from "./useCountdown";
import { useSaveSaleEvent } from "./useSaveSaleEvent";
import {
  formatAUD,
  formatPickupRange,
} from "./saleHelpers";
import type { SaleBundle, SaleEventCore, SaleItem } from "./types";

interface PublicSaleViewProps {
  sale: SaleEventCore;
  sellerName: string | null;
  sellerImage?: string | null;
  items: SaleItem[];
  bundles: SaleBundle[];
  categoriesById: Record<string, { name: string }>;
  /** Blur + "Preview only" badge for the pre-payment paywall preview. */
  preview?: boolean;
  onMessageSeller?: () => void;
  onItemClick?: (adId: string) => void;
  onShare?: () => void;
}

function CountdownCell({ value, unit }: { value: number; unit: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="min-w-[3rem] rounded-lg bg-neutral-800 px-2 py-1.5 text-center font-display text-2xl font-semibold tabular-nums text-white">
        {String(value).padStart(2, "0")}
      </div>
      <span className="mt-1 text-[0.65rem] uppercase tracking-wide text-muted-foreground">
        {unit}
      </span>
    </div>
  );
}

export function PublicSaleView({
  sale,
  sellerName,
  items,
  bundles,
  categoriesById,
  preview = false,
  onMessageSeller,
  onItemClick,
  onShare,
}: PublicSaleViewProps) {
  const { fadeUp, staggerCard, reduced } = useMotionPrefs();
  const countdown = useCountdown(sale.pickupWindowStart);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const { displaySaved, toggleSaved, bookmarkControls } = useSaveSaleEvent(sale._id);
  const shareControls = useAnimation();

  function handleShareClick() {
    onShare?.();
    if (!reduced) {
      void shareControls.start({
        scale: [1, 1.18, 0.96, 1],
        transition: { duration: 0.32, ease: "easeOut" },
      });
    }
  }

  const sold = items.filter((i) => i.isSold).length;
  const available = items.length - sold;
  const totalValue = items.reduce((sum, i) => sum + (i.price ?? 0), 0);
  const sellerFirstName = (sellerName ?? "the seller").split(" ")[0];

  // Category filter bar — only categories present in the sale (no empty pills).
  const categoryPills = useMemo(() => {
    const present = new Map<string, string>();
    for (const item of items) {
      const name = categoriesById[item.categoryId]?.name;
      if (name) present.set(item.categoryId, name);
    }
    return Array.from(present.entries()).map(([id, name]) => ({ id, name }));
  }, [items, categoriesById]);

  const visibleItems =
    activeCategory === "all"
      ? items
      : items.filter((i) => i.categoryId === activeCategory);

  const adById = useMemo(() => {
    const map = new Map<string, SaleItem>();
    for (const item of items) map.set(item._id, item);
    return map;
  }, [items]);

  return (
    <div className={`relative mx-auto w-full max-w-3xl ${preview ? "select-none" : ""}`}>
      <div className={preview ? "pointer-events-none blur-[3px]" : ""}>
        {/* 1. Named hero */}
        <motion.header {...fadeUp(0)} className="px-4 pt-6 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
            <Package size={14} weight="fill" /> Moving sale
          </span>
          <h1 className="mt-3 font-display text-3xl font-semibold leading-tight text-foreground sm:text-4xl">
            {sale.title}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {sale.suburb} · {items.length} {items.length === 1 ? "item" : "items"}
            {bundles.length > 0 &&
              ` · ${bundles.length} ${bundles.length === 1 ? "bundle" : "bundles"}`}
          </p>
          {sale.note && (
            <p className="mx-auto mt-3 max-w-md text-sm text-foreground/80">{sale.note}</p>
          )}
        </motion.header>

        {/* 2. Live countdown to pickup window */}
        <motion.section {...fadeUp(0.05)} className="mt-6 px-4">
          <div className="rounded-2xl border border-border bg-card p-4 text-center">
            {countdown.isLive ? (
              <p className="flex items-center justify-center gap-2 font-semibold text-emerald-600">
                <Clock size={18} weight="fill" /> Pickup window is open now
              </p>
            ) : (
              <>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Pickup window opens in
                </p>
                <div className="mt-2 flex items-start justify-center gap-2">
                  <CountdownCell value={countdown.days} unit="days" />
                  <CountdownCell value={countdown.hours} unit="hrs" />
                  <CountdownCell value={countdown.mins} unit="min" />
                  <CountdownCell value={countdown.secs} unit="sec" />
                </div>
              </>
            )}
            <p className="mt-3 text-sm text-foreground">
              {formatPickupRange(sale.pickupWindowStart, sale.pickupWindowEnd)}
            </p>
            <p className="text-xs text-muted-foreground">Cash or bank transfer</p>
          </div>
        </motion.section>

        {/* 3. Stats strip */}
        <motion.section {...fadeUp(0.1)} className="mt-4 px-4">
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm">
            <span className="font-semibold text-foreground">{available} available</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">{sold} sold</span>
            <span className="text-muted-foreground">·</span>
            <span className="font-semibold text-foreground">
              {formatAUD(totalValue)} total value
            </span>
          </div>
        </motion.section>

        {/* 4. Category filter bar */}
        {categoryPills.length > 1 && (
          <section className="mt-5 px-4">
            <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {[{ id: "all", name: "All" }, ...categoryPills].map((pill) => {
                const active = activeCategory === pill.id;
                return (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => setActiveCategory(pill.id)}
                    className={`whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-foreground hover:border-primary/40"
                    }`}
                  >
                    {pill.name}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* 5. Bundles — above the grid */}
        {bundles.length > 0 && activeCategory === "all" && (
          <motion.section {...fadeUp(0.12)} className="mt-6 px-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold text-foreground">
                Bundles — save when you take more
              </h2>
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                {bundles.length}
              </span>
            </div>
            <div className="space-y-3">
              {bundles.map((bundle) => {
                const members = bundle.adIds
                  .map((id) => adById.get(id))
                  .filter((x): x is SaleItem => Boolean(x));
                const sumPrice = members.reduce((s, m) => s + (m.price ?? 0), 0);
                const saving = sumPrice - bundle.bundlePrice;
                return (
                  <div
                    key={bundle._id}
                    className="rounded-2xl border border-border bg-card p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex -space-x-3">
                        {members.slice(0, 3).map((m) => (
                          <div
                            key={m._id}
                            className="h-12 w-12 overflow-hidden rounded-lg border-2 border-card bg-muted"
                          >
                            <ImageDisplay
                              imageRef={m.images[0]}
                              alt={m.title}
                              className="h-full w-full object-cover"
                              size="thumb"
                            />
                          </div>
                        ))}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-foreground">
                          {bundle.label}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {members.map((m) => m.title).join(" + ")}
                        </p>
                      </div>
                      <div className="text-right">
                        {saving > 0 && (
                          <p className="text-xs text-muted-foreground line-through">
                            {formatAUD(sumPrice)}
                          </p>
                        )}
                        <p className="font-display text-lg font-semibold text-foreground">
                          {formatAUD(bundle.bundlePrice)}
                        </p>
                        {saving > 0 && (
                          <p className="text-xs font-semibold text-emerald-600">
                            save {formatAUD(saving)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.section>
        )}

        {/* 6. Items grid (sold items stay, greyed) */}
        <section className="mt-6 px-4 pb-[calc(var(--bottom-nav-height)_+_6rem)] md:pb-24">
          <h2 className="mb-3 font-display text-lg font-semibold text-foreground">
            {activeCategory === "all"
              ? "All items"
              : categoriesById[activeCategory]?.name}
          </h2>
          {visibleItems.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No items in this category.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {visibleItems.map((item, index) => (
                <motion.button
                  type="button"
                  key={item._id}
                  {...staggerCard(index)}
                  onClick={() => !item.isSold && onItemClick?.(item._id)}
                  className="group relative overflow-hidden rounded-xl border border-border bg-card text-left"
                >
                  <div className="relative aspect-square bg-muted">
                    <ImageDisplay
                      imageRef={item.images[0]}
                      alt={item.title}
                      backdrop
                      className={`h-full w-full object-cover ${
                        item.isSold ? "opacity-40 grayscale" : ""
                      }`}
                      size="card"
                    />
                    {item.isSold && (
                      <span className="absolute left-2 top-2 rounded-full bg-neutral-800 px-2 py-0.5 text-xs font-semibold text-white">
                        Sold
                      </span>
                    )}
                  </div>
                  <div className="p-2">
                    <p className="font-display text-base font-semibold text-foreground">
                      {formatAUD(item.price)}
                    </p>
                    <p className="truncate text-sm text-foreground/80">{item.title}</p>
                    {item.condition && (
                      <p className="truncate text-xs text-muted-foreground">
                        {item.condition}
                      </p>
                    )}
                  </div>
                </motion.button>
              ))}
            </div>
          )}

          {/* 7. Suburb-level location (no street address) */}
          <div className="mt-6 rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <MapPin size={20} weight="fill" />
              </div>
              <div>
                <p className="font-semibold text-foreground">{sale.suburb}</p>
                <p className="text-sm text-muted-foreground">
                  Exact address shared after you message {sellerFirstName}.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Preview-only overlay (paywall) */}
      {preview && (
        <div className="pointer-events-none absolute inset-0 flex items-start justify-center pt-10">
          <span className="rounded-full bg-neutral-900/80 px-4 py-2 text-sm font-semibold text-white shadow-lg backdrop-blur">
            Preview only
          </span>
        </div>
      )}

      {/* 8. Sticky footer CTA — single sale-level conversation.
          Portal'd to document.body: the app shell's scroll container (<main>,
          Layout.tsx) sets `contain: layout style paint` for scroll perf, which
          makes it a containing block for `position: fixed` descendants — so a
          plain fixed div here would pin to <main>'s content height instead of
          the viewport. Same escape hatch as AdDetail's mobile FABs. */}
      {!preview && createPortal(
        <div
          className="fixed inset-x-0 bottom-[var(--bottom-nav-height)] md:bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur"
          style={{ paddingBottom: "var(--safe-area-inset-bottom)" }}
        >
          <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3">
            <button
              type="button"
              onClick={onMessageSeller}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground transition active:scale-[0.99]"
            >
              <ChatCircle size={20} weight="fill" />
              Message {sellerFirstName}
            </button>
            <motion.button
              type="button"
              onClick={handleShareClick}
              whileTap={{ scale: 0.9 }}
              aria-label="Share this sale"
              className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-card text-foreground"
            >
              <motion.span animate={shareControls} style={{ display: "inline-flex" }}>
                <ShareNetwork size={20} />
              </motion.span>
            </motion.button>
            <motion.button
              type="button"
              onClick={() => { void toggleSaved(); }}
              whileTap={{ scale: 0.9 }}
              aria-label={displaySaved ? "Remove from saved" : "Save this sale"}
              aria-pressed={displaySaved}
              className={`flex h-12 w-12 items-center justify-center rounded-xl border transition-colors ${
                displaySaved
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border bg-card text-foreground"
              }`}
            >
              <motion.span animate={bookmarkControls} style={{ display: "inline-flex" }}>
                <BookmarkSimple size={20} weight={displaySaved ? "fill" : "regular"} />
              </motion.span>
            </motion.button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
