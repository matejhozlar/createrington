import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SearchInput } from "@/components/search-input";
import { Paginator } from "@/components/paginator";
import {
  DataTable,
  loadingRowCount,
  TwoLineCellSkeleton,
  type DataTableColumn,
} from "@/components/data-table";
import { Ghost, RefreshCw, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { keepPreviousData, useQuery, useMutation } from "@tanstack/react-query";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useToastActions } from "@/hooks/use-toast";
import { CellText } from "@/components/cell-text";
import {
  formatFullDate,
  formatRelativeDate,
  toIso,
} from "@/features/admin/format";
import { trpc, queryClient, type RouterOutput } from "@/lib/trpc";
import { RemoveGhostModal } from "./modals/RemoveGhostModal";
import { EmptyState, ErrorState } from "@/components/query-states";

type GhostMember =
  RouterOutput["admin"]["inactivity"]["ghosts"]["list"]["items"][number];

export function GhostsCard({ canMutate }: { canMutate: boolean }) {
  const toast = useToastActions();

  const [page, setPage] = useState(0);
  const [limit] = useState(20);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebouncedValue(searchQuery);

  const [removeTarget, setRemoveTarget] = useState<GhostMember | null>(null);

  const capabilitiesQuery = useQuery(
    trpc.admin.inactivity.ghosts.capabilities.queryOptions(),
  );
  const listQuery = useQuery(
    trpc.admin.inactivity.ghosts.list.queryOptions(
      {
        search: debouncedSearch.trim() || undefined,
        page,
        limit,
      },
      { placeholderData: keepPreviousData },
    ),
  );

  const refreshGhosts = useMutation(
    trpc.admin.inactivity.ghosts.refresh.mutationOptions({
      onSuccess: () =>
        void queryClient.invalidateQueries(
          trpc.admin.inactivity.ghosts.pathFilter(),
        ),
    }),
  );

  const ghosts = listQuery.data?.items ?? [];
  const total = listQuery.data?.pagination.total ?? 0;
  const totalPages = listQuery.data?.pagination.totalPages ?? 0;
  const lastRefreshedAt =
    capabilitiesQuery.data?.lastRefreshedAt ??
    listQuery.data?.lastRefreshedAt ??
    null;
  const loading = listQuery.isLoading || listQuery.isPlaceholderData;
  const loadingRows = loadingRowCount(page, limit, total);
  const error = listQuery.error?.message ?? null;

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    setPage(0);
  }, []);

  const handleRefresh = useCallback(async () => {
    try {
      const result = await refreshGhosts.mutateAsync();
      toast.success(`Cache refreshed: ${result.count} ghost(s)`);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to refresh ghost cache",
      );
    }
  }, [refreshGhosts, toast]);

  const columns: DataTableColumn<GhostMember>[] = [
    {
      key: "player",
      header: "Player",
      minWidth: 200,
      skeleton: () => <TwoLineCellSkeleton />,
      render: (ghost) => (
        <div className="min-w-0">
          <CellText
            copy
            value={ghost.minecraftUsername}
            className="font-medium"
          />
          <CellText
            copy
            value={ghost.minecraftUuid}
            display={`${ghost.minecraftUuid.slice(0, 8)}…`}
            className="font-mono text-xs text-muted-foreground"
          />
        </div>
      ),
    },
    {
      key: "discordId",
      header: "Discord ID",
      width: 200,
      render: (ghost) => (
        <CellText
          copy
          value={ghost.discordId}
          className="font-mono text-xs text-muted-foreground"
        />
      ),
    },
    {
      key: "registered",
      header: "Registered",
      width: 140,
      cellClassName: "text-sm text-muted-foreground",
      render: (ghost) => {
        const iso = toIso(ghost.playerCreatedAt);
        return (
          <CellText
            value={formatFullDate(iso)}
            display={formatRelativeDate(iso)}
          />
        );
      },
    },
    {
      key: "lastSeen",
      header: "Last Seen",
      width: 140,
      cellClassName: "text-sm text-muted-foreground",
      render: (ghost) => {
        const iso = toIso(ghost.playerLastSeen);
        return (
          <CellText
            value={formatFullDate(iso)}
            display={formatRelativeDate(iso)}
          />
        );
      },
    },
  ];

  return (
    <>
      <Card className="gap-0">
        <CardHeader className="border-b">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Ghost className="size-5 text-muted-foreground" />
                Members Missing from Discord
              </CardTitle>
              <CardDescription className="mt-1">
                Registered players who are no longer in the Discord guild.
                Manual cleanup only, cache populated on demand.
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">
                {lastRefreshedAt
                  ? `Last refreshed ${formatRelativeDate(toIso(lastRefreshedAt))}`
                  : "Cache not yet populated"}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshGhosts.isPending}
              >
                <RefreshCw
                  className={cn(
                    "mr-2 size-4",
                    refreshGhosts.isPending && "animate-spin",
                  )}
                />
                Refresh
              </Button>
            </div>
          </div>

          <SearchInput
            className="mt-3"
            placeholder="Search by Minecraft username..."
            value={searchQuery}
            onValueChange={handleSearchChange}
          />
        </CardHeader>

        {error ? (
          <ErrorState message={error} onRetry={() => listQuery.refetch()} />
        ) : !loading && ghosts.length === 0 ? (
          <EmptyState
            icon={Ghost}
            message={
              lastRefreshedAt
                ? "No ghost members in the cache"
                : "Click Refresh to populate the cache"
            }
          />
        ) : (
          <>
            <CardContent className="px-0">
              <DataTable
                columns={columns}
                rows={ghosts}
                loading={loading}
                loadingRows={loadingRows}
                rowKey={(ghost) => ghost.discordId}
                actions={(ghost) => [
                  {
                    label: canMutate
                      ? "Remove now"
                      : "Only available on the production deployment",
                    icon: Trash2,
                    variant: "destructive",
                    disabled: !canMutate,
                    onClick: () => setRemoveTarget(ghost),
                  },
                ]}
                actionSlots={1}
              />
            </CardContent>

            {total > 0 && (
              <CardFooter className="border-t">
                <Paginator
                  page={page}
                  limit={limit}
                  total={total}
                  totalPages={totalPages}
                  onPageChange={setPage}
                  itemLabel="ghost"
                  className="w-full"
                />
              </CardFooter>
            )}
          </>
        )}
      </Card>

      <RemoveGhostModal
        ghost={removeTarget}
        onClose={() => setRemoveTarget(null)}
        canMutate={canMutate}
      />
    </>
  );
}
