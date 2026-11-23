import { useCallback, useState } from "react";
import {
  keepPreviousData,
  useQuery,
  type QueryKey,
  type UseQueryOptions,
  type UseQueryResult,
} from "@tanstack/react-query";
import { loadingRowCount } from "@/components/data-table";

const DEFAULT_LIMIT = 20;

export type PageInput = { page: number; limit: number };

type PagedData = {
  items: unknown[];
  pagination: { total: number; totalPages: number };
};

export type PagedRows<T> = {
  rows: T[];
  page: number;
  setPage: (page: number) => void;
  limit: number;
  total: number;
  totalPages: number;
  loading: boolean;
  loadingRows: number;
  error: string | null;
  retry: () => void;
};

export function useResettablePage(resetKey: unknown) {
  const key = JSON.stringify(resetKey ?? null);
  const [state, setState] = useState({ key, page: 0 });
  const page = state.key === key ? state.page : 0;
  const setPage = useCallback(
    (next: number) => setState({ key, page: next }),
    [key],
  );
  return [page, setPage] as const;
}

export function usePagedQuery<
  TFilters extends object,
  TData extends PagedData,
  TError extends { message: string },
  TKey extends QueryKey,
>(
  filters: TFilters,
  options: (
    input: TFilters & PageInput,
  ) => UseQueryOptions<TData, TError, TData, TKey>,
  limit = DEFAULT_LIMIT,
): PagedRows<TData["items"][number]> & {
  query: UseQueryResult<TData, TError>;
} {
  const [page, setPage] = useResettablePage(filters);
  const query = useQuery({
    ...options({ ...filters, page, limit }),
    placeholderData: keepPreviousData,
  });

  const total = query.data?.pagination.total ?? 0;
  const { refetch } = query;
  const retry = useCallback(() => void refetch(), [refetch]);

  return {
    query,
    rows: query.data?.items ?? [],
    page,
    setPage,
    limit,
    total,
    totalPages: query.data?.pagination.totalPages ?? 0,
    loading: query.isLoading || query.isPlaceholderData,
    loadingRows: loadingRowCount(page, limit, total),
    error: query.error?.message ?? null,
    retry,
  };
}
