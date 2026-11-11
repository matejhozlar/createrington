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
import { RefreshCw, UserSearch } from "lucide-react";
import { cn } from "@/lib/utils";
import { keepPreviousData, useQuery, useMutation } from "@tanstack/react-query";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useToastActions } from "@/hooks/use-toast";
import { CellText } from "@/components/cell-text";
import { formatFullDate, toIso } from "@/features/admin/format";
import { formatRelativeDate } from "@/lib/format";
import { trpc, queryClient } from "@/lib/trpc";
import { EmptyState, ErrorState } from "@/components/query-states";

export function UnlinkedMembersCard() {
  const toast = useToastActions();

  const [page, setPage] = useState(0);
  const [limit] = useState(20);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebouncedValue(searchQuery);

  const listQuery = useQuery(
    trpc.admin.inactivity.unlinked.list.queryOptions(
      {
        search: debouncedSearch.trim() || undefined,
        page,
        limit,
      },
      { placeholderData: keepPreviousData },
    ),
  );

  const refreshMembers = useMutation(
    trpc.admin.inactivity.unlinked.refresh.mutationOptions({
      onSuccess: () =>
        void queryClient.invalidateQueries(
          trpc.admin.inactivity.unlinked.pathFilter(),
        ),
    }),
  );

  const members = listQuery.data?.items ?? [];
  const total = listQuery.data?.pagination.total ?? 0;
  const totalPages = listQuery.data?.pagination.totalPages ?? 0;
  const lastRefreshedAt = listQuery.data?.lastRefreshedAt ?? null;
  const loading = listQuery.isLoading || listQuery.isPlaceholderData;
  const loadingRows = loadingRowCount(page, limit, total);
  const error = listQuery.error?.message ?? null;

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    setPage(0);
  }, []);

  const handleRefresh = useCallback(async () => {
    try {
      const result = await refreshMembers.mutateAsync();
      toast.success(`Cache refreshed: ${result.count} member(s)`);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to refresh unlinked member cache",
      );
    }
  }, [refreshMembers, toast]);

  type Member = (typeof members)[number];

  const columns: DataTableColumn<Member>[] = [
    {
      key: "member",
      header: "Member",
      minWidth: 200,
      skeleton: () => <TwoLineCellSkeleton />,
      render: (member) => (
        <div className="min-w-0">
          <CellText copy value={member.displayName} className="font-medium" />
          <CellText
            copy
            value={member.username}
            display={`@${member.username}`}
            className="font-mono text-xs text-muted-foreground"
          />
        </div>
      ),
    },
    {
      key: "discordId",
      header: "Discord ID",
      width: 200,
      render: (member) => (
        <CellText
          copy
          value={member.discordId}
          className="font-mono text-xs text-muted-foreground"
        />
      ),
    },
    {
      key: "joined",
      header: "Joined",
      width: 140,
      cellClassName: "text-sm text-muted-foreground",
      render: (member) => {
        if (!member.joinedAt) return null;
        const iso = toIso(member.joinedAt);
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
    <Card className="gap-0">
      <CardHeader className="border-b">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <UserSearch className="size-5 text-muted-foreground" />
              Members Missing from Database
            </CardTitle>
            <CardDescription className="mt-1">
              Verified Discord members with no matching player record. Read-only
              audit, cache populated on demand.
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
              disabled={refreshMembers.isPending}
            >
              <RefreshCw
                className={cn(
                  "mr-2 size-4",
                  refreshMembers.isPending && "animate-spin",
                )}
              />
              Refresh
            </Button>
          </div>
        </div>

        <SearchInput
          className="mt-3"
          placeholder="Search by name or username..."
          value={searchQuery}
          onValueChange={handleSearchChange}
        />
      </CardHeader>

      {error ? (
        <ErrorState message={error} onRetry={() => listQuery.refetch()} />
      ) : !loading && members.length === 0 ? (
        <EmptyState
          icon={UserSearch}
          message={
            lastRefreshedAt
              ? "No unlinked members in the cache"
              : "Click Refresh to populate the cache"
          }
        />
      ) : (
        <>
          <CardContent className="px-0">
            <DataTable
              columns={columns}
              rows={members}
              loading={loading}
              loadingRows={loadingRows}
              rowKey={(member) => member.discordId}
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
                itemLabel="member"
                className="w-full"
              />
            </CardFooter>
          )}
        </>
      )}
    </Card>
  );
}
