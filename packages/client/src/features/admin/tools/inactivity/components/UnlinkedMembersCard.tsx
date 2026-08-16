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
import { Input } from "@/components/ui/input";
import { Paginator } from "@/components/paginator";
import {
  DataTable,
  loadingRowCount,
  TwoLineCellSkeleton,
  type DataTableColumn,
} from "@/components/data-table";
import { RefreshCw, Search, UserSearch } from "lucide-react";
import { cn } from "@/lib/utils";
import { keepPreviousData } from "@tanstack/react-query";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useToastActions } from "@/hooks/use-toast";
import { CellText } from "@/components/cell-text";
import { formatFullDate, formatRelativeDate } from "@/features/admin/format";
import { trpc } from "@/lib/trpc";

function toIso(value: string | Date): string {
  return typeof value === "string" ? value : new Date(value).toISOString();
}

export function UnlinkedMembersCard() {
  const toast = useToastActions();

  const [page, setPage] = useState(0);
  const [limit] = useState(20);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebouncedValue(searchQuery, 500);

  const listQuery = trpc.admin.inactivity.unlinked.list.useQuery(
    {
      search: debouncedSearch.trim() || undefined,
      page,
      limit,
    },
    { placeholderData: keepPreviousData },
  );

  const refreshMembers = trpc.admin.inactivity.unlinked.refresh.useMutation();

  const { refetch: refetchList } = listQuery;

  const members = listQuery.data?.items ?? [];
  const total = listQuery.data?.pagination.total ?? 0;
  const totalPages = listQuery.data?.pagination.totalPages ?? 0;
  const lastRefreshedAt = listQuery.data?.lastRefreshedAt ?? null;
  const loading = listQuery.isLoading || listQuery.isPlaceholderData;
  const loadingRows = loadingRowCount(page, limit, total);
  const error = listQuery.error?.message ?? null;

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchQuery(e.target.value);
      setPage(0);
    },
    [],
  );

  const handleRefresh = useCallback(async () => {
    try {
      const result = await refreshMembers.mutateAsync();
      toast.success(`Cache refreshed: ${result.count} member(s)`);
      refetchList();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to refresh unlinked member cache",
      );
    }
  }, [refreshMembers, toast, refetchList]);

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

        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by name or username..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="pl-9"
          />
        </div>
      </CardHeader>

      {error ? (
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <p className="text-destructive">{error}</p>
            <Button
              onClick={() => listQuery.refetch()}
              className="mt-4"
              variant="outline"
            >
              Try Again
            </Button>
          </div>
        </CardContent>
      ) : !loading && members.length === 0 ? (
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <UserSearch className="mx-auto size-12 text-muted-foreground" />
            <p className="mt-2 text-muted-foreground">
              {lastRefreshedAt
                ? "No unlinked members in the cache"
                : "Click Refresh to populate the cache"}
            </p>
          </div>
        </CardContent>
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
