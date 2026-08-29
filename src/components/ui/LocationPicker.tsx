import { useEffect, useId, useRef, useState } from "react";
import { CircleNotch } from "@phosphor-icons/react";
import {
  searchLocations,
  formatLocation,
  fetchLocations,
  locationsUnavailable,
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
 *
 * Offline fallback: if the suburb dataset can't load, requiring a pick would
 * dead-end the flow (SetupStep blocks submit on an empty `value`). In that case
 * the typed text is committed as the value verbatim — consumers already store
 * plain strings (legacy free-text suburbs exist) — and a quiet note says
 * suggestions are unavailable.
 */
export function LocationPicker({
  value,
  onChange,
  id,
  inputClassName,
  initialQuery,
}: {
  value: string;
  /**
   * `loc` is the dataset row behind the pick — `undefined` when the value is
   * free text (dataset unavailable) or when the field was cleared. Callers that
   * STORE a location must pass it on; a caller that only filters can ignore it.
   */
  onChange: (formatted: string, loc?: LocationData) => void;
  id?: string;
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
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isSearching, setIsSearching] = useState(false);
  // Sticky once the dataset fetch has failed: fetchLocations() caches its
  // (empty) failure result for the session, so there is nothing to retry.
  const [suggestionsUnavailable, setSuggestionsUnavailable] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  const pick = (loc: LocationData) => {
    const formatted = formatLocation(loc);
    setQuery(formatted);
    onChange(formatted, loc);
    setShowSuggestions(false);
    setActiveIndex(-1);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      void (async () => {
        // A query equal to the confirmed selection means the user just picked it
        // (or hasn't touched the field) — nothing to search for.
        if (query === value || query.length < 2) {
          setSuggestions([]);
          setShowSuggestions(false);
          setActiveIndex(-1);
          return;
        }
        setIsSearching(true);
        try {
          const results = await searchLocations(query);
          if (results.length === 0 && locationsUnavailable()) {
            // Dataset fetch failed: fall back to free text so the flow isn't
            // blocked — the typed text becomes the value as-is.
            setSuggestionsUnavailable(true);
            setSuggestions([]);
            onChange(query);
            return;
          }
          setSuggestions(results.slice(0, 8));
          setShowSuggestions(results.length > 0);
          setActiveIndex(-1);
        } finally {
          setIsSearching(false);
        }
      })();
    }, 300);
    return () => clearTimeout(timer);
    // onChange is deliberately not a dependency: consumers pass state setters,
    // and re-debouncing on every parent render would defeat the timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const isOpen = showSuggestions && suggestions.length > 0;

  return (
    <div className="relative" ref={wrapperRef}>
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={
          isOpen && activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined
        }
        className={inputClassName}
        value={query}
        maxLength={100}
        placeholder="Enter suburb or postcode"
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
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setShowSuggestions(false);
            setActiveIndex(-1);
            return;
          }
          if (!isOpen) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIndex((i) => (i + 1) % suggestions.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
          } else if (e.key === "Enter" && suggestions[activeIndex]) {
            e.preventDefault();
            pick(suggestions[activeIndex]);
          }
        }}
      />
      {isSearching && (
        <CircleNotch
          size={16}
          className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground"
        />
      )}
      {isOpen && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute z-10 mt-2 max-h-60 w-full overflow-y-auto rounded-2xl bg-popover py-1 shadow-lg ring-1 ring-border/70"
        >
          {suggestions.map((loc, index) => (
            <button
              key={loc.id}
              id={`${listboxId}-option-${index}`}
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              onClick={() => pick(loc)}
              className={`flex min-h-[44px] w-full items-center justify-between px-4 py-2.5 text-left text-sm transition-colors hover:bg-muted/60 ${
                index === activeIndex ? "bg-muted/60" : ""
              }`}
            >
              <span className="font-medium text-foreground">{loc.locality}</span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {loc.state} {loc.postcode}
              </span>
            </button>
          ))}
        </div>
      )}
      {suggestionsUnavailable && (
        <p role="status" className="mt-1.5 text-xs text-muted-foreground">
          Suggestions unavailable — type your suburb and continue.
        </p>
      )}
    </div>
  );
}
