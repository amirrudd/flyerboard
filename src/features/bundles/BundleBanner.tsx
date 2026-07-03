import { motion } from "framer-motion";
import { Package } from "@phosphor-icons/react";
import { ImageDisplay } from "../../components/ui/ImageDisplay";
import { formatPrice } from "../../lib/priceFormatter";
import { useMotionPrefs } from "../../hooks/useMotionPrefs";

interface BundleBannerItem {
  adId: string;
  title: string;
  image: string | null;
  price: number;
  isCurrent: boolean;
}

interface BundleBannerProps {
  bundleId: string;
  label: string;
  bundlePrice: number;
  separatelyTotal: number;
  savings: number;
  savingsPct: number;
  itemCount: number;
  items: BundleBannerItem[];
  onItemClick: (adId: string) => void;
}

/**
 * Ad-detail "Available as a bundle" banner (blue accent, mirrors the Moving
 * Sale banner in AdDetail.tsx but with its own visual identity). Renders when
 * the current ad belongs to an ACTIVE standalone bundle
 * (`api.bundles.getBundleBannerForAd`). Purely presentational — the caller is
 * responsible for the query + feature-flag gate.
 */
export function BundleBanner({
  bundlePrice,
  separatelyTotal,
  savings,
  savingsPct,
  items,
  onItemClick,
}: BundleBannerProps) {
  const { whileInView } = useMotionPrefs();

  const otherTitles = items.filter((i) => !i.isCurrent).map((i) => i.title);
  const othersLabel =
    otherTitles.length === 1
      ? otherTitles[0]
      : otherTitles.length > 1
        ? `${otherTitles.slice(0, -1).join(", ")} and ${otherTitles[otherTitles.length - 1]}`
        : "";
  const takeWord = items.length > 2 ? "all" : "both";

  return (
    <motion.div
      {...whileInView(0.05)}
      className="mb-6 w-full rounded-2xl border border-blue-500/20 bg-blue-50/60 p-4 text-left dark:bg-blue-500/[0.06]"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white">
          <Package size={20} weight="fill" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-foreground">Available as a bundle</span>
          <span className="block truncate text-xs text-muted-foreground">
            {othersLabel && `With ${othersLabel} — `}save {formatPrice(savings)} if you take {takeWord}
          </span>
        </span>
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        {/* Thumbnail row: all items in bundle order, "+" connector between each.
            Current item is dimmed/outlined ("you're here") and not clickable;
            every other item is a button that navigates to that ad. */}
        <div className="flex items-center gap-1.5">
          {items.map((item, i) => (
            <div key={item.adId} className="flex items-center gap-1.5">
              {i > 0 && <span className="text-xs font-semibold text-muted-foreground">+</span>}
              {item.isCurrent ? (
                <div
                  className="h-[52px] w-[52px] shrink-0 overflow-hidden rounded-md ring-2 ring-blue-500"
                  aria-label={`${item.title} (you're viewing this item)`}
                >
                  <ImageDisplay imageRef={item.image} alt="" className="h-full w-full object-cover opacity-50" />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onItemClick(item.adId)}
                  className="h-[52px] w-[52px] shrink-0 overflow-hidden rounded-md bg-muted transition active:scale-[0.92]"
                  title={item.title}
                >
                  <ImageDisplay imageRef={item.image} alt={item.title} className="h-full w-full object-cover" />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Price math */}
        <div className="shrink-0 text-right">
          <p className="font-display text-lg font-semibold text-foreground leading-none tabular">
            {formatPrice(bundlePrice)} <span className="text-xs font-normal text-muted-foreground">together</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground line-through decoration-muted-foreground/50">
            vs {formatPrice(separatelyTotal)} separately
          </p>
          <span className="mt-1 inline-block rounded-full bg-blue-500/15 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:text-blue-400">
            Save {savingsPct}%
          </span>
        </div>
      </div>
    </motion.div>
  );
}
