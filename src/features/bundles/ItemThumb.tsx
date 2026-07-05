import { Package } from "@phosphor-icons/react";
import { ImageDisplay } from "../../components/ui/ImageDisplay";

interface ItemThumbProps {
  image: string | null;
  title: string;
  /** Placeholder icon size when the item has no image. */
  iconSize?: number;
}

/** Shared item image tile — falls back to a Package placeholder when there's no image. */
export function ItemThumb({ image, title, iconSize = 18 }: ItemThumbProps) {
  return image ? (
    <ImageDisplay imageRef={image} alt={title} className="h-full w-full object-cover" />
  ) : (
    <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
      <Package size={iconSize} weight="light" />
    </div>
  );
}

export default ItemThumb;
