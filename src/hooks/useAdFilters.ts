import { useSearchParams } from "react-router-dom";
import { useCallback } from "react";

// Note: there is intentionally no "sort" option. The feed is always newest-first
// (the product's "pin to top" model depends on it), so the only filter we offer
// is a price range — it narrows results without ever reordering them.
export function useAdFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  const minPrice = Number(searchParams.get("minPrice")) || undefined;
  const maxPrice = Number(searchParams.get("maxPrice")) || undefined;
  const hasActiveFilters = minPrice !== undefined || maxPrice !== undefined;

  const setParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(searchParams);
      if (value) next.set(key, value);
      else next.delete(key);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const clearFilters = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete("minPrice");
    next.delete("maxPrice");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  return { minPrice, maxPrice, hasActiveFilters, setParam, clearFilters };
}
