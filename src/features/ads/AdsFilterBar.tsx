import { SlidersHorizontal, ChevronDown } from "lucide-react";
import { useAdFilters } from "../../hooks/useAdFilters";

export function AdsFilterBar() {
  const { sort, minPrice, maxPrice, hasActiveFilters, setParam, clearFilters } = useAdFilters();

  return (
    <div className="flex items-center gap-2.5 mb-5 flex-wrap">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <SlidersHorizontal className="w-3.5 h-3.5" strokeWidth={2} />
        <span className="kicker">Filter</span>
      </div>
      <div className="w-px h-4 bg-border/70" />

      {/* Sort */}
      <div className="relative">
        <select
          aria-label="Sort listings"
          value={sort}
          onChange={e => setParam("sort", e.target.value === "newest" ? "" : e.target.value)}
          className="h-8 pl-3 pr-7 rounded-full bg-card ring-1 ring-border/70 text-xs font-semibold text-foreground appearance-none cursor-pointer hover:ring-foreground/20 transition-all focus:outline-none focus:ring-primary/50"
        >
          <option value="newest">Newest</option>
          <option value="price_asc">Price: Low → High</option>
          <option value="price_desc">Price: High → Low</option>
        </select>
        <ChevronDown className="w-3 h-3 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
      </div>

      {/* Price range */}
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
