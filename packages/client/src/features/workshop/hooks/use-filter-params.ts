import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

export function useFilterParams() {
  const [searchParams, setSearchParams] = useSearchParams();

  const setParam = useCallback(
    (
      key: string,
      value: string,
      fallback = "",
      options?: { replace?: boolean },
    ) => {
      if ((searchParams.get(key) ?? fallback) === value) return;
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value === fallback) next.delete(key);
          else next.set(key, value);
          return next;
        },
        { replace: options?.replace ?? true },
      );
    },
    [searchParams, setSearchParams],
  );

  const [searchInput, setSearchInput] = useState(
    () => searchParams.get("q") ?? "",
  );
  const debouncedSearch = useDebouncedValue(searchInput, 250);
  const query = debouncedSearch.trim().toLowerCase();

  useEffect(() => {
    setParam("q", debouncedSearch.trim(), "");
  }, [debouncedSearch, setParam]);

  return {
    searchParams,
    setParam,
    searchInput,
    setSearchInput,
    query,
  } as const;
}
