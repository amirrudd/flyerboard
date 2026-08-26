import { MapPin } from "@phosphor-icons/react";
import { displayLocation } from "../../lib/locationService";

interface NearbyBoundaryProps {
  /** The selected canonical location string ("Richmond, VIC 3121"). */
  location: string;
  /** Whether any in-area results render above this boundary. */
  hasNearResults: boolean;
  /** Active category name, so an empty area names the real absence. */
  categoryName?: string | null;
  onClearLocation?: () => void;
}

/**
 * The rule 5 boundary between the in-area and out-of-area groups (location
 * groups, it doesn't hide — `.agent/PRODUCT-RULES.md`). Two modes, one
 * component:
 *
 * - Divider (near results exist): a labelled hairline before the far group.
 * - Banner (nothing near): leads the grid instead of a bare divider, says what
 *   was FOUND (never what exists), and offers to clear the location. With a
 *   category active it names it — otherwise the user blames the location for a
 *   category-shaped absence.
 *
 * `role="separator"` with visible text — deliberately NOT a live region: a
 * static divider isn't a change to announce.
 */
export function NearbyBoundary({
  location,
  hasNearResults,
  categoryName,
  onClearLocation,
}: NearbyBoundaryProps) {
  const suburb = displayLocation(location);

  if (hasNearResults) {
    return (
      <div
        role="separator"
        aria-label={`Further from ${suburb}`}
        className="col-span-full flex items-center gap-3 py-2"
      >
        <div className="hairline flex-1" />
        <span className="kicker shrink-0 flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5" weight="bold" aria-hidden />
          Further from {suburb}
        </span>
        <div className="hairline flex-1" />
      </div>
    );
  }

  return (
    <div className="col-span-full text-center py-10 px-4 rounded-xl bg-muted/40 ring-1 ring-border/60">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-background ring-1 ring-border/60 mb-4">
        <MapPin className="w-6 h-6 text-muted-foreground/70" weight="light" aria-hidden />
      </div>
      <h3 className="font-display text-xl sm:text-2xl font-medium text-foreground mb-1.5 tracking-tight">
        {categoryName
          ? `No ${categoryName} in ${suburb} right now`
          : `Nothing in ${suburb} right now`}
      </h3>
      <p className="text-muted-foreground text-sm mb-4">
        Showing the newest flyers from further out.
      </p>
      <button
        type="button"
        onClick={onClearLocation}
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
      >
        Clear location
      </button>
    </div>
  );
}
