import { Sliders } from '@phosphor-icons/react';
import { useAdFilters } from "../../hooks/useAdFilters";

export function AdsFilterBar() {
  const { minPrice, maxPrice, hasActiveFilters, setParam, clearFilters } = useAdFilters();

  return (
    <div className="flex items-center gap-2.5 pt-1 mb-5 flex-wrap">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Sliders className="w-3.5 h-3.5" />
        <span className="kicker">Price</span>
      </div>
      <div className="w-px h-4 bg-border/70" />

      {/* Price range — the feed stays newest-first; we never expose a sort control */}
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          placeholder="Min $"
          value={minPrice ?? ""}
          onChange={e => setParam("minPrice", e.target.value)}
          className="w-20 h-8 px-3 rounded-full bg-card ring-1 ring-border/70 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-primary/50 transition-all [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <span className="text-muted-foreground text-xs">–</span>
        <input
          type="number"
          placeholder="Max $"
          value={maxPrice ?? ""}
          onChange={e => setParam("maxPrice", e.target.value)}
          className="w-20 h-8 px-3 rounded-full bg-card ring-1 ring-border/70 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-primary/50 transition-all [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
      </div>

      {hasActiveFilters && (
        <button
          onClick={clearFilters}
          className="h-8 px-3 rounded-full text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
        >
          Clear
        </button>
      )}
    </div>
  );
}
