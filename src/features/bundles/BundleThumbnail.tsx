import { Package } from "@phosphor-icons/react";
import { ImageDisplay } from "../../components/ui/ImageDisplay";

interface BundleThumbnailProps {
  /** Cover image refs, one per bundled item. */
  covers: string[];
  /** Total items in the bundle. */
  itemCount: number;
}

const strip = "relative overflow-hidden bg-muted";

/**
 * The Bundle card's thumbnail slot. N vertical strips (2 for a 2-item bundle,
 * 3 for 3, 4 for 4), each `object-cover`, degrading gracefully when there are
 * fewer covers than items. Card shell (aspect ratio, badge, footer) lives in
 * AdsGrid — this only fills the image slot.
 */
export function BundleThumbnail({ covers, itemCount }: BundleThumbnailProps) {
  // 0 covers — Package placeholder.
  if (covers.length === 0) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-muted text-muted-foreground">
        <Package size={28} weight="fill" />
        <span className="px-2 text-center text-[11px] font-medium">
          {itemCount} {itemCount === 1 ? "item" : "items"}
        </span>
      </div>
    );
  }

  // 1 cover — single image (blurred-backdrop fill, like the ad grid).
  if (covers.length === 1) {
    return (
      <ImageDisplay
        imageRef={covers[0]}
        alt=""
        backdrop
        className="h-full w-full object-cover"
      />
    );
  }

  // 2-4 covers — that many vertical strips. Cap at 4 strips even if more covers exist.
  const shown = covers.slice(0, 4);
  return (
    <div className="grid h-full w-full gap-px bg-border" style={{ gridTemplateColumns: `repeat(${shown.length}, minmax(0, 1fr))` }}>
      {shown.map((ref, i) => (
        <div key={i} className={strip}>
          <ImageDisplay imageRef={ref} alt="" className="h-full w-full object-cover" />
        </div>
      ))}
    </div>
  );
}
