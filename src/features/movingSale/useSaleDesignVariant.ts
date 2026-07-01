import { useState } from "react";

const STORAGE_KEY = "fb_movingsale_variant";

export type SaleDesignVariant = "A" | "B";

/** `?variant=a|b` from the URL, if present — always the strongest override. */
export function getUrlVariantOverride(): SaleDesignVariant | null {
  if (typeof window === "undefined") return null;
  const fromQuery = new URLSearchParams(window.location.search)
    .get("variant")
    ?.toUpperCase();
  return fromQuery === "A" || fromQuery === "B" ? fromQuery : null;
}

function resolveVariant(): SaleDesignVariant {
  if (typeof window === "undefined") return "A";

  const fromQuery = getUrlVariantOverride();
  if (fromQuery) {
    try {
      window.localStorage.setItem(STORAGE_KEY, fromQuery);
    } catch {
      /* private browsing / storage disabled — override still applies this visit */
    }
    return fromQuery;
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "A" || stored === "B") return stored;
    const assigned: SaleDesignVariant = Math.random() < 0.5 ? "A" : "B";
    window.localStorage.setItem(STORAGE_KEY, assigned);
    return assigned;
  } catch {
    return "A";
  }
}

/**
 * A/B split between the two public sale-page designs (Variant A: the original
 * card-based layout; Variant B: the editorial redesign). No analytics pipeline
 * exists in this app yet, so this is a lightweight, self-contained assignment:
 * a `?variant=a|b` URL param always wins (and is persisted, so the override
 * sticks for that browser); otherwise a 50/50 coin flip is made once per
 * browser and persisted to localStorage so repeat visits see the same design.
 *
 * Resolved once via React's lazy `useState` initializer — not an effect — so
 * it never touches localStorage/Math.random on re-renders.
 *
 * Precedence with the admin `movingSaleDesignForceB` feature flag (checked by
 * the caller, e.g. `PublicSalePage`) is: URL override > force flag > this
 * per-browser assignment. The URL override is exposed separately via
 * `getUrlVariantOverride()` so the caller can implement that precedence
 * without duplicating the query-param parsing.
 */
export function useSaleDesignVariant(): SaleDesignVariant {
  const [variant] = useState(resolveVariant);
  return variant;
}
