import { useSearchParams } from "react-router-dom";
import { useCallback } from "react";

export type SortOption = "newest" | "price_asc" | "price_desc";

export function useAdFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  const sort = (searchParams.get("sort") || "newest") as SortOption;
  const minPrice = Number(searchParams.get("minPrice")) || undefined;
  const maxPrice = Number(searchParams.get("maxPrice")) || undefined;
  const hasActiveFilters = sort !== "newest" || minPrice !== undefined || maxPrice !== undefined;

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
    next.delete("sort");
    next.delete("minPrice");
    next.delete("maxPrice");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  return { sort, minPrice, maxPrice, hasActiveFilters, setParam, clearFilters };
}
