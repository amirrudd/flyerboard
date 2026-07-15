import { House } from "@phosphor-icons/react";
import { ImageDisplay } from "../../components/ui/ImageDisplay";

interface SaleThumbnailProps {
  /** First up-to-3 item image refs. */
  covers: string[];
  /** Number of sale items that have a photo (drives the layout). */
  photoCount: number;
  /** Total items in the sale (for the "+N" overlay). */
  itemCount: number;
  suburb: string;
}

const cell = "relative overflow-hidden bg-muted";

/**
 * The Moving Sale card's thumbnail slot. A 2×2 image grid that degrades
 * gracefully with how many items have photos, so the card never looks broken:
 *   4+ → 3 covers + "+N items" overlay · 3 → 2×2 with a placeholder cell ·
 *   2 → two strips · 1 → single image · 0 → house placeholder.
 * Card shell (aspect ratio, badge, footer) lives in AdsGrid — this only fills the
 * image slot.
 */
export function SaleThumbnail({ covers, photoCount, itemCount, suburb }: SaleThumbnailProps) {
  // 0 photos — house + suburb placeholder.
  if (photoCount === 0) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-muted text-muted-foreground">
        <House size={28} weight="light" />
        <span className="px-2 text-center text-[11px] font-medium">{suburb}</span>
      </div>
    );
  }

  // 1 photo — single image (blurred-backdrop fill, like the ad grid).
  if (photoCount === 1) {
    return (
      <ImageDisplay
        imageRef={covers[0]}
        alt=""
        backdrop
        className="h-full w-full object-cover"
        size="card"
      />
    );
  }

  // 2 photos — two vertical strips.
  if (photoCount === 2) {
    return (
      <div className="grid h-full w-full grid-cols-2 gap-px bg-border">
        {covers.slice(0, 2).map((ref, i) => (
          <div key={i} className={cell}>
            <ImageDisplay imageRef={ref} alt="" className="h-full w-full object-cover" size="card" />
          </div>
        ))}
      </div>
    );
  }

  // 3 or 4+ photos — 2×2 grid. Cell 4 is the "+N" overlay (4+) or a placeholder (3).
  const overflow = itemCount - 3;
  return (
    <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-px bg-border">
      {[0, 1, 2].map((i) => (
        <div key={i} className={cell}>
          <ImageDisplay imageRef={covers[i]} alt="" className="h-full w-full object-cover" size="card" />
        </div>
      ))}
      {photoCount >= 4 ? (
        <div className="relative flex items-center justify-center bg-neutral-900/70 text-white">
          <span className="font-display text-base font-semibold tabular">
            +{overflow}
          </span>
        </div>
      ) : (
        <div className="flex items-center justify-center bg-muted text-muted-foreground">
          <House size={18} weight="light" />
        </div>
      )}
    </div>
  );
}
