import { CaretLeft, Flag, Image as ImageIcon } from "@phosphor-icons/react";
import { ImageDisplay } from "../../components/ui/ImageDisplay";
import { formatPrice } from "../../lib/priceFormatter";

export interface ConversationHeaderProps {
  /** R2 image reference (or URL) for the item thumbnail. */
  image?: string | null;
  title: string;
  subtitle?: string;
  price?: number;
  onBack?: () => void;
  onViewItem?: () => void;
  /** Label for the view action — "View flyer" (default) or "View sale". */
  viewItemLabel?: string;
  onReport?: () => void;
}

/**
 * Item-context strip above a conversation: back button (optional), 40px
 * thumbnail, title/price/subtitle, "View flyer"/"View sale" link, and a
 * report-flag button.
 */
export function ConversationHeader({
  image,
  title,
  subtitle,
  price,
  onBack,
  onViewItem,
  viewItemLabel = "View flyer",
  onReport,
}: ConversationHeaderProps) {
  return (
    <header className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-border/70 bg-card">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="inline-flex items-center justify-center w-10 h-10 -ml-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 active:scale-[0.98] transition-all shrink-0"
        >
          <CaretLeft className="w-5 h-5" />
        </button>
      )}

      {image ? (
        <ImageDisplay
          imageRef={image}
          alt={title}
          className="w-10 h-10 object-cover rounded-lg ring-1 ring-border/60 shrink-0"
        />
      ) : (
        <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center ring-1 ring-border/60 shrink-0">
          <ImageIcon className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <h2 className="font-display text-base font-semibold tracking-tight text-foreground truncate">
          {title}
        </h2>
        {(price !== undefined || subtitle) && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
            {price !== undefined && (
              <span className="font-semibold text-foreground tabular-nums shrink-0">
                {formatPrice(price)}
              </span>
            )}
            {subtitle && <span className="truncate">{subtitle}</span>}
          </div>
        )}
      </div>

      {onViewItem && (
        <button
          type="button"
          onClick={onViewItem}
          className="text-primary hover:underline text-sm font-semibold shrink-0 active:scale-[0.98] transition-all"
        >
          {viewItemLabel}
        </button>
      )}

      {onReport && (
        <button
          type="button"
          onClick={onReport}
          aria-label="Report conversation"
          className="inline-flex items-center justify-center w-10 h-10 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 active:scale-[0.98] transition-all shrink-0"
        >
          <Flag className="w-4 h-4" aria-hidden="true" />
        </button>
      )}
    </header>
  );
}
