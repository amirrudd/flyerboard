import { useEffect, useRef, useState } from "react";
import { CircleNotch } from "@phosphor-icons/react";
import {
  searchLocations,
  formatLocation,
  fetchLocations,
  type LocationData,
} from "../../lib/locationService";

/**
 * Suburb autocomplete over `public/australian-postcodes.json`, emitting the
 * canonical `formatLocation()` string ("RICHMOND, VIC 3121").
 *
 * That string is the ONLY thing the location filter matches on — free text never
 * will — so anything that stores a location has to come through a picker. This
 * one is the shared version; PostAd and Header still hand-roll their own copies
 * of the same behaviour inline and should be folded into it when either is next
 * touched.
 *
 * `value` is the confirmed selection ("" = nothing picked yet). Typing anything
 * that isn't the confirmed string clears it, so a caller can require a real pick
 * simply by checking `value`.
 */
export function LocationPicker({
  value,
  onChange,
  id,
  placeholder = "Enter suburb or postcode",
  inputClassName,
  initialQuery,
}: {
  value: string;
  onChange: (formatted: string) => void;
  id?: string;
  placeholder?: string;
  inputClassName?: string;
  /**
   * Prefill the visible text WITHOUT treating it as a confirmed pick. Used to
   * show a legacy free-text suburb so the seller can see what to replace —
   * `value` stays empty, so the field is still unconfirmed and submit is blocked.
   */
  initialQuery?: string;
}) {
  const [query, setQuery] = useState(value || initialQuery || "");
  const [suggestions, setSuggestions] = useState<LocationData[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      void (async () => {
        // A query equal to the confirmed selection means the user just picked it
        // (or hasn't touched the field) — nothing to search for.
        if (query === value || query.length < 2) {
          setSuggestions([]);
          setShowSuggestions(false);
          return;
        }
        setIsSearching(true);
        try {
          const results = await searchLocations(query);
          setSuggestions(results.slice(0, 8));
          setShowSuggestions(results.length > 0);
        } finally {
          setIsSearching(false);
        }
      })();
    }, 300);
    return () => clearTimeout(timer);
  }, [query, value]);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div className="relative" ref={wrapperRef}>
      <input
        id={id}
        type="text"
        className={inputClassName}
        value={query}
        maxLength={100}
        placeholder={placeholder}
        // Prefetch the postcode dataset on focus so it's warm before the first
        // keystroke; fetchLocations() caches internally, so repeats are free.
        onFocus={() => {
          void fetchLocations();
          if (suggestions.length > 0) setShowSuggestions(true);
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          if (value && e.target.value !== value) onChange("");
        }}
      />
      {isSearching && (
        <CircleNotch
          size={16}
          className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground"
        />
      )}
      {showSuggestions && suggestions.length > 0 && (
        <div
          role="listbox"
          className="absolute z-10 mt-2 max-h-60 w-full overflow-y-auto rounded-2xl bg-popover py-1 shadow-lg ring-1 ring-border/70"
        >
          {suggestions.map((loc) => (
            <button
              key={loc.id}
              type="button"
              role="option"
              aria-selected={false}
              onClick={() => {
                const formatted = formatLocation(loc);
                setQuery(formatted);
                onChange(formatted);
                setShowSuggestions(false);
              }}
              className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition-colors hover:bg-muted/60"
            >
              <span className="font-medium text-foreground">{loc.locality}</span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {loc.state} {loc.postcode}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
