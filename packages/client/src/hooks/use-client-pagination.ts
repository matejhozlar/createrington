import { useResettablePage, type PagedRows } from "@/hooks/use-paged-query";

export function useClientPagination<T>(
  rows: T[],
  {
    perPage,
    resetKey,
    loading,
    error,
    retry,
  }: {
    perPage: number;
    resetKey: unknown;
    loading: boolean;
    error: string | null;
    retry: () => void;
  },
): PagedRows<T> {
  const [requestedPage, setPage] = useResettablePage(resetKey);
  const totalPages = Math.ceil(rows.length / perPage);
  const page = Math.min(requestedPage, Math.max(0, totalPages - 1));

  return {
    rows: rows.slice(page * perPage, (page + 1) * perPage),
    page,
    setPage,
    limit: perPage,
    total: rows.length,
    totalPages,
    loading,
    loadingRows: perPage,
    error,
    retry,
  };
}
