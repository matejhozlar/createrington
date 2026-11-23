import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CardDescription, CardTitle } from "@/components/ui/card";
import { SearchInput } from "@/components/search-input";
import { TableCard } from "@/components/paged-table";
import {
  TwoLineCellSkeleton,
  type DataTableColumn,
} from "@/components/data-table";
import { RefreshCw, UserSearch } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMutation } from "@tanstack/react-query";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useMutationToast } from "@/hooks/use-mutation-toast";
import { usePagedQuery } from "@/hooks/use-paged-query";
import { CellDate, CellText } from "@/components/cell-text";
import { toIso } from "@/features/admin/format";
import { formatRelativeDate } from "@/lib/format";
import { trpc, queryClient } from "@/lib/trpc";

export function UnlinkedMembersCard() {
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebouncedValue(searchQuery);

  const members = usePagedQuery(
    { search: debouncedSearch.trim() || undefined },
    (input) => trpc.admin.inactivity.unlinked.list.queryOptions(input),
  );

  const refreshMembers = useMutation(
    trpc.admin.inactivity.unlinked.refresh.mutationOptions(
      useMutationToast({
        success: (result) => `Cache refreshed: ${result.count} member(s)`,
        onSuccess: () =>
          void queryClient.invalidateQueries(
            trpc.admin.inactivity.unlinked.pathFilter(),
          ),
      }),
    ),
  );

  const lastRefreshedAt = members.query.data?.lastRefreshedAt ?? null;

  const handleRefresh = () => refreshMembers.mutate();

  type Member = (typeof members.rows)[number];

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
      render: (member) => <CellDate value={member.joinedAt} relative />,
    },
  ];

  return (
    <TableCard
      header={
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <UserSearch className="size-5 text-muted-foreground" />
                Members Missing from Database
              </CardTitle>
              <CardDescription className="mt-1">
                Verified Discord members with no matching player record.
                Read-only audit, cache populated on demand.
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
            onValueChange={setSearchQuery}
          />
        </>
      }
      paged={members}
      empty={{
        icon: UserSearch,
        message: lastRefreshedAt
          ? "No unlinked members in the cache"
          : "Click Refresh to populate the cache",
      }}
      itemLabel="member"
      columns={columns}
      rowKey={(member) => member.discordId}
    />
  );
}
