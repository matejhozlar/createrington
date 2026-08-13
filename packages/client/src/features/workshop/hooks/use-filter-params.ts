import { useCallback } from "react";
import { useSearchParams } from "react-router";

export function useFilterParams() {
  const [searchParams, setSearchParams] = useSearchParams();

  const setParam = useCallback(
    (
      key: string,
      value: string,
      fallback = "",
      options?: { push?: boolean },
    ) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value === fallback) next.delete(key);
          else next.set(key, value);
          return next;
        },
        { replace: !options?.push },
      );
    },
    [setSearchParams],
  );

  return { searchParams, setParam } as const;
}
