import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CardDescription, CardTitle } from "@/components/ui/card";
import { SearchInput } from "@/components/search-input";
import { TableCard } from "@/components/paged-table";
import {
  TwoLineCellSkeleton,
  type DataTableColumn,
} from "@/components/data-table";
import { Ghost, RefreshCw, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useMutationToast } from "@/hooks/use-mutation-toast";
import { usePagedQuery } from "@/hooks/use-paged-query";
import { CellDate, CellText } from "@/components/cell-text";
import { toIso } from "@/features/admin/format";
import { formatRelativeDate } from "@/lib/format";
import { trpc, queryClient, type RouterOutput } from "@/lib/trpc";
import { RemoveGhostModal } from "./modals/RemoveGhostModal";

type GhostMember =
  RouterOutput["admin"]["inactivity"]["ghosts"]["list"]["items"][number];

export function GhostsCard({ canMutate }: { canMutate: boolean }) {
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebouncedValue(searchQuery);

  const [removeTarget, setRemoveTarget] = useState<GhostMember | null>(null);

  const capabilitiesQuery = useQuery(
    trpc.admin.inactivity.ghosts.capabilities.queryOptions(),
  );
  const ghosts = usePagedQuery(
    { search: debouncedSearch.trim() || undefined },
    (input) => trpc.admin.inactivity.ghosts.list.queryOptions(input),
  );

  const refreshGhosts = useMutation(
    trpc.admin.inactivity.ghosts.refresh.mutationOptions(
      useMutationToast({
        success: (result) => `Cache refreshed: ${result.count} ghost(s)`,
        onSuccess: () =>
          void queryClient.invalidateQueries(
            trpc.admin.inactivity.ghosts.pathFilter(),
          ),
      }),
    ),
  );

  const lastRefreshedAt =
    capabilitiesQuery.data?.lastRefreshedAt ??
    ghosts.query.data?.lastRefreshedAt ??
    null;

  const handleRefresh = () => refreshGhosts.mutate();

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
      render: (ghost) => <CellDate value={ghost.playerCreatedAt} relative />,
    },
    {
      key: "lastSeen",
      header: "Last Seen",
      width: 140,
      cellClassName: "text-sm text-muted-foreground",
      render: (ghost) => <CellDate value={ghost.playerLastSeen} relative />,
    },
  ];

  return (
    <>
      <TableCard
        header={
          <>
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
              onValueChange={setSearchQuery}
            />
          </>
        }
        paged={ghosts}
        empty={{
          icon: Ghost,
          message: lastRefreshedAt
            ? "No ghost members in the cache"
            : "Click Refresh to populate the cache",
        }}
        itemLabel="ghost"
        columns={columns}
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

      <RemoveGhostModal
        ghost={removeTarget}
        onClose={() => setRemoveTarget(null)}
        canMutate={canMutate}
      />
    </>
  );
}
