import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { motion, useAnimation } from "framer-motion";
import {
  Package,
  ShareNetwork,
  BookmarkSimple,
  ChatCircle,
  Clock,
  Money,
  UsersThree,
  Timer,
} from "@phosphor-icons/react";
import { ImageDisplay } from "../../components/ui/ImageDisplay";
import { getInitials } from "../../lib/displayName";
import { useMotionPrefs } from "../../hooks/useMotionPrefs";
import { useCountdown } from "./useCountdown";
import { useSaveSaleEvent } from "./useSaveSaleEvent";
import { formatAUD, formatPickupRange } from "./saleHelpers";
import type { SaleBundle, SaleEventCore, SaleItem } from "./types";

interface PublicSaleViewEditorialProps {
  sale: SaleEventCore;
  sellerName: string | null;
  sellerImage?: string | null;
  sellerVerified?: boolean;
  items: SaleItem[];
  bundles: SaleBundle[];
  categoriesById: Record<string, { name: string }>;
  /** Blur + "Preview only" badge for the pre-payment paywall preview. */
  preview?: boolean;
  onMessageSeller?: () => void;
  onItemClick?: (adId: string) => void;
  onShare?: () => void;
}

const LOGISTICS_TAGS = [
  { icon: Money, label: "Cash or transfer" },
  { icon: UsersThree, label: "Bring a friend for big stuff" },
  { icon: Timer, label: "First in, best dressed" },
];

/**
 * Variant B of the public sale page — editorial, serif-led redesign (A/B
 * tested against `PublicSaleView` via `useSaleDesignVariant`). Same data
 * contract as `PublicSaleView` plus optional seller photo/verified badge.
 */
export function PublicSaleViewEditorial({
  sale,
  sellerName,
  sellerImage,
  sellerVerified,
  items,
  bundles,
  categoriesById,
  preview = false,
  onMessageSeller,
  onItemClick,
  onShare,
}: PublicSaleViewEditorialProps) {
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

  const sellerFirstName = (sellerName ?? "the seller").split(" ")[0];

  const sold = items.filter((i) => i.isSold).length;
  const available = items.length - sold;
  const totalValue = items.reduce((sum, i) => sum + (i.price ?? 0), 0);

  const categoryPills = useMemo(() => {
    const present = new Map<string, string>();
    for (const item of items) {
      const name = categoriesById[item.categoryId]?.name;
      if (name) present.set(item.categoryId, name);
    }
    return Array.from(present.entries()).map(([id, name]) => ({ id, name }));
  }, [items, categoriesById]);

  const adById = useMemo(() => {
    const map = new Map<string, SaleItem>();
    for (const item of items) map.set(item._id, item);
    return map;
  }, [items]);

  // On "All", the strongest available item leads as a full-width "Most
  // wanted" feature card; everything else (minus the feature) fills the grid.
  const featured =
    activeCategory === "all"
      ? (items.find((i) => !i.isSold) ?? items[0])
      : undefined;
  const visibleItems =
    activeCategory === "all"
      ? items.filter((i) => i._id !== featured?._id)
      : items.filter((i) => i.categoryId === activeCategory);

  const bestBundleId = useMemo(() => {
    let bestId: string | null = null;
    let bestSaving = 0;
    for (const bundle of bundles) {
      const sum = bundle.adIds
        .map((id) => adById.get(id)?.price ?? 0)
        .reduce((s, p) => s + p, 0);
      const saving = sum - bundle.bundlePrice;
      if (saving > bestSaving) {
        bestSaving = saving;
        bestId = bundle._id;
      }
    }
    return bestId;
  }, [bundles, adById]);

  return (
    <div className={`relative mx-auto w-full max-w-3xl ${preview ? "select-none" : ""}`}>
      <div className={preview ? "pointer-events-none blur-[3px]" : ""}>
        {/* 1. Hero */}
        <motion.header {...fadeUp(0)} className="relative px-4 pt-6">
          {/* Rotated "stamp" badge — from the original mockup; carries the
              suburb so the hero reads as a physical flyer at a glance. */}
          <div
            className="absolute right-5 top-6 -rotate-[9deg] rounded-lg border-[2.5px] border-primary bg-card/60 px-2.5 py-1.5 text-center text-primary shadow-[inset_0_0_0_1.5px_hsl(var(--primary)/0.25)]"
            aria-hidden="true"
          >
            <div className="font-display text-[15px] font-bold leading-[0.92]">MOVING</div>
            <div className="font-display text-[15px] font-bold leading-[0.92]">SALE</div>
            <div className="mt-0.5 text-[7.5px] font-bold tracking-[0.15em]">
              {sale.suburb.split(",")[0].toUpperCase()}
            </div>
          </div>

          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
            <Package size={14} weight="fill" /> Moving sale
          </span>

          <h1 className="mt-3.5 max-w-xs font-display text-5xl font-semibold leading-[0.93] tracking-tight text-foreground">
            Everything must{" "}
            <em className="text-primary not-italic font-semibold italic">go.</em>
          </h1>

          {/* Seller */}
          <div className="mt-5 flex items-center gap-3">
            {sellerImage ? (
              <ImageDisplay
                imageRef={sellerImage}
                alt={sellerName ?? "Seller"}
                className="h-11 w-11 shrink-0 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary font-display text-lg font-semibold text-primary-foreground">
                {getInitials({ name: sellerName ?? "User" })}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[15px] font-bold text-foreground">
                <span className="truncate">{sellerName ?? "the seller"}'s moving sale</span>
                {sellerVerified && (
                  <img src="/verified-badge.svg" alt="Verified Seller" className="h-4 w-4 shrink-0 dark:brightness-125 dark:contrast-125" />
                )}
              </div>
              <p className="text-sm text-muted-foreground">{sale.suburb}</p>
            </div>
          </div>

          {sale.note && (
            <p className="mt-4 border-l-[3px] border-border pl-3.5 font-display text-[15px] italic leading-relaxed text-foreground/80">
              "{sale.note}"
            </p>
          )}
        </motion.header>

        {/* 2. Live countdown to pickup window — inverted panel for contrast */}
        <motion.section {...fadeUp(0.05)} className="mt-5 px-4">
          <div className="rounded-[22px] bg-neutral-900 p-5 text-center text-neutral-50 dark:bg-black">
            {countdown.isLive ? (
              <p className="flex items-center justify-center gap-2 font-semibold text-emerald-400">
                <Clock size={18} weight="fill" /> Pickup window is open now
              </p>
            ) : (
              <>
                <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-neutral-400">
                  Doors open in
                </p>
                <div className="mt-3 flex items-start justify-center gap-2">
                  <CountdownCell value={countdown.days} unit="days" />
                  <span className="font-display text-2xl leading-[1.1] text-neutral-600">:</span>
                  <CountdownCell value={countdown.hours} unit="hrs" />
                  <span className="font-display text-2xl leading-[1.1] text-neutral-600">:</span>
                  <CountdownCell value={countdown.mins} unit="min" />
                  <span className="font-display text-2xl leading-[1.1] text-neutral-600">:</span>
                  <CountdownCell value={countdown.secs} unit="sec" accent />
                </div>
              </>
            )}
            <p className="mt-4 text-sm font-medium text-neutral-200">
              {formatPickupRange(sale.pickupWindowStart, sale.pickupWindowEnd)}
            </p>
            <p className="mt-0.5 text-xs text-neutral-400">Cash or bank transfer on pickup</p>
          </div>
        </motion.section>

        {/* 3. Stats strip */}
        <motion.section {...fadeUp(0.08)} className="mt-5 px-6">
          <div className="grid grid-cols-3">
            <div className="border-r border-border text-center">
              <div className="font-display text-3xl font-semibold leading-none text-foreground">{available}</div>
              <div className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">available</div>
            </div>
            <div className="border-r border-border text-center">
              <div className="font-display text-3xl font-semibold leading-none text-muted-foreground/60">{sold}</div>
              <div className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">sold</div>
            </div>
            <div className="text-center">
              <div className="font-display text-3xl font-semibold leading-none text-foreground">{formatAUD(totalValue)}</div>
              <div className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">of stuff</div>
            </div>
          </div>
        </motion.section>

        {/* 4. Bundles — "take the whole room" */}
        {bundles.length > 0 && (
          <motion.section {...fadeUp(0.1)} className="mt-7 px-4">
            <div className="mb-3.5 flex items-baseline justify-between">
              <h2 className="font-display text-xl font-semibold tracking-tight text-foreground">
                Take the whole room
              </h2>
              <span className="text-xs font-semibold text-muted-foreground">
                {bundles.length} {bundles.length === 1 ? "bundle" : "bundles"}
              </span>
            </div>
            <div className="flex flex-col gap-3">
              {bundles.map((bundle) => {
                const members = bundle.adIds
                  .map((id) => adById.get(id))
                  .filter((x): x is SaleItem => Boolean(x));
                const sumPrice = members.reduce((s, m) => s + (m.price ?? 0), 0);
                const saving = sumPrice - bundle.bundlePrice;
                return (
                  <div
                    key={bundle._id}
                    className="relative flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-sm"
                  >
                    {bundle._id === bestBundleId && (
                      <span className="absolute -top-2.5 left-4 rounded-md bg-primary px-2 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wide text-primary-foreground">
                        Best value
                      </span>
                    )}
                    <div className="flex shrink-0">
                      {members.slice(0, 3).map((m, i) => (
                        <div
                          key={m._id}
                          className="h-[46px] w-[46px] overflow-hidden rounded-xl border-2 border-card bg-muted shadow-sm"
                          style={{ marginLeft: i === 0 ? 0 : -14 }}
                        >
                          <ImageDisplay imageRef={m.images[0]} alt={m.title} className="h-full w-full object-cover" />
                        </div>
                      ))}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold text-foreground">{bundle.label}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {members.map((m) => m.title).join(" · ")}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      {saving > 0 && (
                        <p className="text-xs text-muted-foreground/70 line-through">{formatAUD(sumPrice)}</p>
                      )}
                      <p className="font-display text-xl font-bold leading-none text-foreground">
                        {formatAUD(bundle.bundlePrice)}
                      </p>
                      {saving > 0 && (
                        <p className="mt-0.5 text-[11px] font-bold text-emerald-600">save {formatAUD(saving)}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.section>
        )}

        {/* 5. Category filter bar */}
        {categoryPills.length > 1 && (
          <div className="sticky top-[57px] z-20 mt-7 bg-gradient-to-b from-background via-background/95 to-transparent px-0 pb-2 pt-3 backdrop-blur-sm">
            <div className="flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {[{ id: "all", name: "All" }, ...categoryPills].map((pill) => {
                const active = activeCategory === pill.id;
                return (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => setActiveCategory(pill.id)}
                    className={`whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-semibold transition ${
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
          </div>
        )}

        {/* 6. Items */}
        <section className="px-4 pt-2 pb-[calc(var(--bottom-nav-height)_+_6rem)] md:pb-24">
          <h2 className="mb-3.5 px-1 font-display text-xl font-semibold tracking-tight text-foreground">
            {activeCategory === "all" ? "All items" : categoriesById[activeCategory]?.name}
          </h2>

          {/* Featured — "most wanted" */}
          {featured && (
            <motion.button
              type="button"
              {...fadeUp(0.12)}
              onClick={() => !featured.isSold && onItemClick?.(featured._id)}
              className="mb-3 block w-full overflow-hidden rounded-[22px] border border-border bg-card text-left"
            >
              <div className="relative aspect-[16/11] bg-muted">
                <ImageDisplay imageRef={featured.images[0]} alt={featured.title} backdrop className="h-full w-full object-cover" />
                <span className="absolute left-3 top-3 rounded-full bg-neutral-900 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wide text-white">
                  Most wanted
                </span>
              </div>
              <div className="flex items-end justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate text-[17px] font-bold text-foreground">{featured.title}</p>
                  {featured.condition && (
                    <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
                      {featured.condition} condition
                    </p>
                  )}
                </div>
                <p className="shrink-0 font-display text-[32px] font-bold leading-none text-primary">
                  {formatAUD(featured.price)}
                </p>
              </div>
            </motion.button>
          )}

          {visibleItems.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No items in this category.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {visibleItems.map((item, index) => (
                <motion.button
                  type="button"
                  key={item._id}
                  {...staggerCard(index)}
                  onClick={() => !item.isSold && onItemClick?.(item._id)}
                  className="overflow-hidden rounded-2xl border border-border bg-card text-left"
                >
                  <div className="relative aspect-square bg-muted">
                    <ImageDisplay
                      imageRef={item.images[0]}
                      alt={item.title}
                      backdrop
                      className={`h-full w-full object-cover ${item.isSold ? "grayscale opacity-50" : ""}`}
                    />
                    {item.isSold && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="-rotate-[9deg] rounded-md border-2 border-primary bg-background/75 px-3 py-0.5 font-display text-lg font-bold tracking-widest text-primary">
                          SOLD
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="p-2.5">
                    <p className={`font-display text-lg font-bold leading-none ${item.isSold ? "text-muted-foreground line-through" : "text-foreground"}`}>
                      {formatAUD(item.price)}
                    </p>
                    <p className={`mt-1.5 truncate text-sm ${item.isSold ? "text-muted-foreground" : "text-foreground/80"}`}>
                      {item.title}
                    </p>
                    {item.condition && (
                      <p className="mt-0.5 truncate text-[10.5px] uppercase tracking-wide text-muted-foreground/70">
                        {item.isSold ? "Picked up" : item.condition}
                      </p>
                    )}
                  </div>
                </motion.button>
              ))}
            </div>
          )}

          {/* 7. Suburb-level location */}
          <div className="mt-6 overflow-hidden rounded-[22px] border border-border bg-card">
            <div
              className="relative flex h-[110px] items-center justify-center bg-muted"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(45deg, hsl(var(--muted-foreground) / .08) 0 10px, transparent 10px 20px)",
              }}
            >
              <div className="flex h-9 w-9 rotate-[-45deg] items-center justify-center rounded-[50%_50%_50%_0] bg-primary shadow-[0_6px_14px_-4px_hsl(var(--primary)/0.6)]">
                <span className="h-2.5 w-2.5 rotate-45 rounded-full bg-card" />
              </div>
              <span className="absolute bottom-2 right-2.5 text-[9.5px] tracking-wide text-muted-foreground/70">
                MAP · SUBURB LEVEL
              </span>
            </div>
            <div className="p-4">
              <p className="font-bold text-foreground">{sale.suburb}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Exact address shared after you message {sellerFirstName}.
              </p>
            </div>
          </div>

          {/* 8. Logistics tags */}
          <div className="mt-3 flex flex-wrap gap-2">
            {LOGISTICS_TAGS.map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-foreground/80"
              >
                <Icon size={14} weight="bold" />
                {label}
              </span>
            ))}
          </div>
        </section>

        {/* Preview-only overlay (paywall) */}
        {preview && (
          <div className="pointer-events-none absolute inset-0 flex items-start justify-center pt-10">
            <span className="rounded-full bg-neutral-900/80 px-4 py-2 text-sm font-semibold text-white shadow-lg backdrop-blur">
              Preview only
            </span>
          </div>
        )}
      </div>

      {/* 9. Sticky footer CTA — portal'd to escape the app shell's scroll
          container, whose `contain: layout style paint` (perf optimization)
          would otherwise make it a containing block for this fixed element.
          Same pattern as AdDetail's mobile FABs / PublicSaleView's footer. */}
      {!preview && createPortal(
        <div
          className="fixed inset-x-0 bottom-[var(--bottom-nav-height)] z-40 border-t border-border bg-card/95 backdrop-blur md:bottom-0"
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

function CountdownCell({ value, unit, accent = false }: { value: number; unit: string; accent?: boolean }) {
  return (
    <div className="text-center">
      <div className={`font-display text-[34px] font-semibold leading-none tabular-nums ${accent ? "text-primary" : "text-neutral-50"}`}>
        {String(value).padStart(2, "0")}
      </div>
      <span className="mt-1.5 block text-[10px] uppercase tracking-wide text-neutral-500">{unit}</span>
    </div>
  );
}
