import { motion } from "framer-motion";
import {
  BookmarkSimple,
  ChatCircle,
  MapPin,
  Package,
  SealCheck,
  ShareNetwork,
  ShieldCheck,
} from "@phosphor-icons/react";
import { ImageDisplay } from "../../components/ui/ImageDisplay";
import { formatPrice } from "../../lib/priceFormatter";
import { useMotionPrefs } from "../../hooks/useMotionPrefs";
import { useSaveBundle } from "./useSaveBundle";
import type { Id } from "../../../convex/_generated/dataModel";

/** Structural mirror of `api.bundles.getPublicBundle`'s payload. */
export interface PublicBundleItem {
  adId: string;
  title: string;
  image: string | null;
  price: number;
  condition: string | null;
  isSold: boolean;
}

export interface PublicBundleData {
  _id: string;
  label: string;
  status: "active" | "partial" | "sold";
  bundlePrice: number;
  separatelyTotal: number;
  savings: number;
  savingsPct: number;
  location: string;
  isOwner: boolean;
  seller: { _id: string; name?: string | null; image?: string | null; isVerified: boolean } | null;
  items: PublicBundleItem[];
}

interface PublicBundleViewProps {
  bundle: PublicBundleData;
  onMessageSeller: () => void;
  onItemClick: (adId: string) => void;
  onManage?: () => void;
  onShare: () => void;
}

/**
 * Public bundle detail page — the "Deal Ticket" (bundle v2 design). The page
 * leads with the OFFER, not the products: a receipt-style card with line-item
 * prices, the struck-through "separately" total, the bundle price at display
 * size, and a save stamp. Product images are a supporting strip below, each
 * linking to its member ad. Deliberately looks nothing like an ad page.
 */
export function PublicBundleView({
  bundle,
  onMessageSeller,
  onItemClick,
  onManage,
  onShare,
}: PublicBundleViewProps) {
  const { fadeUp } = useMotionPrefs();
  const { displaySaved, toggleSaved, bookmarkControls } = useSaveBundle(
    bundle._id as Id<"saleBundles">
  );

  const sellerFirst = (bundle.seller?.name ?? "the seller").split(" ")[0];
  const soldItems = bundle.items.filter((i) => i.isSold);
  const availableItems = bundle.items.filter((i) => !i.isSold);
  const isActive = bundle.status === "active";

  return (
    <div className="min-h-[100dvh] bg-background">
      {/* ── Teal offer band ─────────────────────────────────────────────── */}
      <div className="bg-bundle text-bundle-foreground">
        <div className="mx-auto max-w-2xl px-5 pb-20 pt-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[0.7rem] font-bold uppercase tracking-[0.16em] opacity-85">
                <Package size={14} weight="fill" aria-hidden="true" />
                Bundle deal{bundle.location ? ` · ${bundle.location}` : ""}
              </p>
              <h1 className="mt-1 font-display text-2xl font-semibold tracking-[-0.01em] sm:text-3xl">
                {bundle.label}
              </h1>
              <p className="mt-0.5 text-sm opacity-85">
                {bundle.items.length} items · sold together or separately
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <motion.button
                type="button"
                animate={bookmarkControls}
                onClick={() => { void toggleSaved(); }}
                aria-label={displaySaved ? "Remove bundle from saved" : "Save bundle"}
                aria-pressed={displaySaved}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/25 transition hover:bg-white/25"
              >
                <BookmarkSimple size={19} weight={displaySaved ? "fill" : "regular"} />
              </motion.button>
              <button
                type="button"
                onClick={onShare}
                aria-label="Share bundle"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/25 transition hover:bg-white/25"
              >
                <ShareNetwork size={19} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-5 pb-[calc(var(--bottom-nav-height)_+_6rem)] md:pb-28">
        {/* ── The ticket ──────────────────────────────────────────────── */}
        <motion.section
          {...fadeUp(0)}
          aria-label="Bundle deal pricing"
          className="relative -mt-14 rounded-2xl bg-card p-6 shadow-card ring-1 ring-border/70"
        >
          {/* Status notice replaces the deal when it's gone */}
          {bundle.status !== "active" && (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl bg-muted px-4 py-3 text-sm text-foreground">
              <Package size={17} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span>
                {bundle.status === "sold" ? (
                  <strong>This bundle has been sold.</strong>
                ) : (
                  <>
                    <strong>This bundle is no longer available</strong>
                    {soldItems.length > 0 && (
                      <> — {soldItems.map((i) => i.title).join(", ")} {soldItems.length === 1 ? "has" : "have"} sold</>
                    )}
                    . The remaining items are still for sale individually.
                  </>
                )}
              </span>
            </div>
          )}

          {/* Line items */}
          <ul className="m-0 list-none p-0">
            {bundle.items.map((item) => (
              <li key={item.adId} className={`flex items-baseline gap-2 py-1.5 text-sm ${item.isSold ? "opacity-55" : ""}`}>
                <span className={`min-w-0 truncate font-semibold text-foreground ${item.isSold ? "line-through decoration-muted-foreground/60" : ""}`}>
                  {item.title}
                </span>
                {item.isSold && (
                  <span className="shrink-0 rounded-full bg-foreground px-2 py-0.5 text-[0.6rem] font-extrabold uppercase tracking-[0.1em] text-background">
                    Sold
                  </span>
                )}
                <span aria-hidden="true" className="mx-1 flex-1 -translate-y-0.5 border-b-2 border-dotted border-border" />
                <span className={`shrink-0 font-semibold tabular-nums text-foreground ${item.isSold ? "line-through decoration-muted-foreground/60 font-medium" : ""}`}>
                  {formatPrice(item.price)}
                </span>
              </li>
            ))}
          </ul>

          {isActive ? (
            <>
              {/* Perforated rule with edge notches */}
              <div aria-hidden="true" className="relative -mx-6 my-4 border-t-2 border-dashed border-border">
                <span className="absolute -left-2.5 -top-2.5 h-5 w-5 rounded-full bg-background" />
                <span className="absolute -right-2.5 -top-2.5 h-5 w-5 rounded-full bg-background" />
              </div>

              <div className="flex items-baseline justify-between text-sm text-muted-foreground">
                <span>Separately</span>
                <span className="tabular-nums line-through decoration-muted-foreground/60">
                  {formatPrice(bundle.separatelyTotal)}
                </span>
              </div>

              <div className="mt-2 flex items-end justify-between gap-4">
                <div>
                  <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-bundle-emphasis">
                    Bundle price
                  </p>
                  <p className="font-display text-[2.6rem] font-bold leading-none tracking-[-0.02em] text-foreground">
                    {formatPrice(bundle.bundlePrice)}
                  </p>
                </div>
                {bundle.savings > 0 && (
                  <div
                    className="-rotate-6 self-center rounded-lg border-[2.5px] border-bundle-emphasis px-2.5 py-1.5 text-center text-xs font-extrabold uppercase tracking-[0.08em] text-bundle-emphasis"
                    aria-label={`Save ${formatPrice(bundle.savings)} (${bundle.savingsPct}% off)`}
                  >
                    Save {formatPrice(bundle.savings)}
                    <span className="block text-[0.6rem] tracking-[0.12em] opacity-80">
                      {bundle.savingsPct}% off
                    </span>
                  </div>
                )}
              </div>
            </>
          ) : (
            availableItems.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
                {availableItems.map((item) => (
                  <button
                    key={item.adId}
                    type="button"
                    onClick={() => onItemClick(item.adId)}
                    className="text-sm font-bold text-bundle-emphasis hover:underline"
                  >
                    Buy {item.title} for {formatPrice(item.price)} ›
                  </button>
                ))}
              </div>
            )
          )}
        </motion.section>

        {/* ── Image strip ─────────────────────────────────────────────── */}
        <motion.div {...fadeUp(0.05)} className="mt-5 flex gap-3">
          {bundle.items.map((item) => (
            <button
              key={item.adId}
              type="button"
              onClick={() => onItemClick(item.adId)}
              className="min-w-0 flex-1 text-left"
              title={item.title}
            >
              <div className={`aspect-square overflow-hidden rounded-xl bg-muted ring-1 ring-border/60 ${item.isSold ? "opacity-55 grayscale" : ""}`}>
                {item.image ? (
                  <ImageDisplay imageRef={item.image} alt={item.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                    <Package size={22} aria-hidden="true" />
                  </div>
                )}
              </div>
              <p className="mt-1.5 truncate text-center text-xs font-semibold text-foreground">
                {item.title} <span className="font-medium text-muted-foreground">· {formatPrice(item.price)}</span>
              </p>
            </button>
          ))}
        </motion.div>

        {/* ── Trust line ──────────────────────────────────────────────── */}
        <motion.p {...fadeUp(0.08)} className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
          <ShieldCheck size={15} className="mt-0.5 shrink-0 text-bundle-emphasis" aria-hidden="true" />
          Every item stays individually listed — tap any thumbnail to see its full ad.
        </motion.p>

        {/* ── Seller ──────────────────────────────────────────────────── */}
        {bundle.seller && (
          <motion.div
            {...fadeUp(0.1)}
            className="mt-5 flex items-center gap-3 rounded-2xl bg-card px-4 py-3.5 ring-1 ring-border/70"
          >
            {bundle.seller.image ? (
              <ImageDisplay
                imageRef={bundle.seller.image}
                alt=""
                className="h-10 w-10 rounded-full object-cover ring-1 ring-border/60"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-bundle/10 font-semibold text-bundle-emphasis">
                {(bundle.seller.name ?? "?").slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1 truncate text-sm font-semibold text-foreground">
                {bundle.seller.name ?? "FlyerBoard seller"}
                {bundle.seller.isVerified && (
                  <SealCheck size={15} weight="fill" className="shrink-0 text-bundle-emphasis" aria-label="Verified seller" />
                )}
              </p>
              {bundle.location && (
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin size={12} aria-hidden="true" /> {bundle.location}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </div>

      {/* ── Sticky CTA ──────────────────────────────────────────────────── */}
      <div
        className="fixed inset-x-0 bottom-[var(--bottom-nav-height)] z-40 border-t border-border bg-card/95 backdrop-blur md:bottom-0"
        style={{ paddingBottom: "var(--safe-area-inset-bottom)" }}
      >
        <div className="mx-auto flex max-w-2xl items-center gap-4 px-5 py-3">
          {isActive && (
            <div className="leading-tight">
              <p className="text-lg font-extrabold tabular-nums text-foreground">{formatPrice(bundle.bundlePrice)}</p>
              <p className="text-[0.7rem] tabular-nums text-muted-foreground line-through decoration-muted-foreground/60">
                {formatPrice(bundle.separatelyTotal)}
              </p>
            </div>
          )}
          {bundle.isOwner ? (
            <button
              type="button"
              onClick={onManage}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-bundle px-4 py-3.5 text-sm font-bold text-bundle-foreground transition active:scale-[0.99]"
            >
              <Package size={17} weight="fill" aria-hidden="true" />
              This is your bundle — manage it
            </button>
          ) : bundle.status === "sold" ? (
            <p className="flex-1 text-center text-sm font-semibold text-muted-foreground">
              This bundle has been sold
            </p>
          ) : (
            <button
              type="button"
              onClick={onMessageSeller}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-bundle px-4 py-3.5 text-sm font-bold text-bundle-foreground transition active:scale-[0.99]"
            >
              <ChatCircle size={17} weight="fill" aria-hidden="true" />
              {isActive ? `Take the deal — message ${sellerFirst}` : `Message ${sellerFirst}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
