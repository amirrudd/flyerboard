import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { usePaginatedQuery, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { m } from "framer-motion";
import { MagnifyingGlass } from '@phosphor-icons/react';
import { useNavigate } from "react-router-dom";
import { formatPrice } from "../../lib/priceFormatter";
import { entryKey } from "../../context/freshAdsMerge";
import { displayLocation } from "../../lib/locationService";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 200);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (open) {
      // Reset search state each time the palette opens (sync to `open` prop).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuery("");
      setDebouncedQuery("");
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const { results: listings } = usePaginatedQuery(
    api.ads.getAds,
    debouncedQuery ? { search: debouncedQuery } : "skip",
    { initialNumItems: 6 }
  );

  const categories = useQuery(api.categories.getCategories);

  const matchedCategories = useMemo(
    () =>
      debouncedQuery && categories
        ? categories
            .filter(c => c.name.toLowerCase().includes(debouncedQuery.toLowerCase()))
            .slice(0, 3)
        : [],
    [categories, debouncedQuery]
  );

  const handleSelectListing = useCallback(
    (to: string, initialAd?: unknown) => {
      void navigate(to, initialAd ? { state: { initialAd } } : undefined);
      onClose();
    },
    [navigate, onClose]
  );

  /**
   * One row per search entry. Search returns all three ad types (rules 1/4),
   * so a Bundle or Moving Sale matched by a member's title is reachable from
   * here too — it just links to its own page instead of /ad/:id.
   */
  const rows = useMemo(
    () =>
      (listings ?? []).map((entry) => {
        if (entry.kind === "bundle") {
          const c = entry.card;
          return {
            key: entryKey(entry),
            title: c.label,
            subtitle: [`Bundle · ${c.itemCount} items`, c.location && displayLocation(c.location)].filter(Boolean).join(" · "),
            trailing: formatPrice(c.bundlePrice),
            select: () => handleSelectListing(`/bundle/${c._id}`),
          };
        }
        if (entry.kind === "sale") {
          const c = entry.card;
          return {
            key: entryKey(entry),
            title: c.title,
            subtitle: [`Moving Sale · ${c.itemCount} items`, displayLocation(c.suburb)].filter(Boolean).join(" · "),
            trailing: c.minPrice > 0 ? `From ${formatPrice(c.minPrice)}` : null,
            select: () => handleSelectListing(`/sale/${c.slug}`),
          };
        }
        const ad = entry.ad;
        return {
          key: entryKey(entry),
          title: ad.title,
          subtitle: displayLocation(ad.location),
          trailing:
            ad.listingType === "exchange"
              ? "Trade"
              : ad.price != null
              ? formatPrice(ad.price)
              : null,
          select: () => handleSelectListing(`/ad/${ad._id}`, ad),
        };
      }),
    [listings, handleSelectListing]
  );

  const handleSelectCategory = useCallback(
    (slug: string) => {
      void navigate(`/?category=${slug}`);
      onClose();
    },
    [navigate, onClose]
  );

  const hasResults = matchedCategories.length > 0 || rows.length > 0;
  const showEmptyState = debouncedQuery && !hasResults;

  if (!open) return null;

  return createPortal(
    <m.div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
    >
      <div className="absolute inset-0 bg-black/50" aria-hidden="true" onMouseDown={onClose} />

      <m.div
        className="relative w-full max-w-xl bg-card ring-1 ring-border/70 rounded-2xl shadow-card-hover overflow-hidden"
        initial={{ opacity: 0, scale: 0.97, y: -8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: -8 }}
        transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/60">
          <MagnifyingGlass className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search listings or categories…"
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
          <kbd className="hidden sm:inline-flex items-center gap-0.5 text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5">
            ESC
          </kbd>
        </div>

        <div className="max-h-[min(400px,60vh)] overflow-y-auto overscroll-contain">
          {!debouncedQuery && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Type to search listings or categories
            </p>
          )}

          {showEmptyState && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No results for &ldquo;{debouncedQuery}&rdquo;
            </p>
          )}

          {matchedCategories.length > 0 && (
            <section>
              <p className="kicker px-4 pt-3 pb-1 text-muted-foreground">
                Categories
              </p>
              <ul>
                {matchedCategories.map((cat) => (
                  <li key={cat._id}>
                    <button
                      type="button"
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-accent transition-colors"
                      onClick={() => handleSelectCategory(cat.slug)}
                    >
                      {cat.name}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {rows.length > 0 && (
            <section>
              <p className="kicker px-4 pt-3 pb-1 text-muted-foreground">
                Listings
              </p>
              <ul>
                {rows.map((row) => (
                  <li key={row.key}>
                    <button
                      type="button"
                      className="w-full text-left px-4 py-2.5 flex items-center justify-between gap-4 hover:bg-accent transition-colors"
                      onClick={row.select}
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-foreground line-clamp-1">
                          {row.title}
                        </span>
                        {row.subtitle && (
                          <span className="block text-xs text-muted-foreground truncate">
                            {row.subtitle}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 text-sm font-medium text-foreground">
                        {row.trailing}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {hasResults && <div className="h-2" />}
        </div>
      </m.div>
    </m.div>,
    document.body
  );
}
