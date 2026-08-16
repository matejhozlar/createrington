import { useCallback, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CellText } from "@/components/cell-text";
import {
  BadgeCellSkeleton,
  DataTable,
  loadingRowCount,
  type DataTableColumn,
} from "@/components/data-table";
import { Loading } from "@/components/loading-spinner";
import { Paginator } from "@/components/paginator";
import { PlayerLabel } from "@/components/player-label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatFullDateSafe,
  formatRelativeDateSafe,
} from "@/features/admin/format";
import { trpc } from "@/lib/trpc";
import type { RouterOutput } from "@/lib/trpc";
import type { DimensionFilter } from "../types";
import {
  ChunkDetailTable,
  type ChunkSortField,
  type ChunkSortState,
} from "./ChunkDetailTable";

export type SoloPlayersData =
  RouterOutput["admin"]["parties"]["chunkSoloPlayers"];
type SoloPlayer = SoloPlayersData["items"][number];

const CHUNKS_PER_PAGE = 50;
const PLAYERS_PER_PAGE = 50;

export type SoloSortKey =
  | "player"
  | "totalChunks"
  | "forceloadableChunks"
  | "activeChunks"
  | "allyStatus"
  | "lastSyncedAt";

export type SoloSortState = { key: SoloSortKey; dir: "asc" | "desc" } | null;

export function ChunkSoloPlayersSection({
  serverId,
  page,
  data,
  isLoading,
  onPageChange,
  dimensionFilter,
  activeOnly,
  sort,
  onSortChange,
}: {
  serverId: number;
  page: number;
  data: SoloPlayersData | undefined;
  isLoading: boolean;
  onPageChange: (page: number) => void;
  dimensionFilter: DimensionFilter;
  activeOnly: boolean;
  sort: SoloSortState;
  onSortChange: (key: SoloSortKey) => void;
}) {
  const [expandedUuid, setExpandedUuid] = useState<string | null>(null);

  const sortProps = (key: SoloSortKey) => ({
    sorted: sort?.key === key ? sort.dir : (false as const),
    onSort: () => onSortChange(key),
  });

  const columns: DataTableColumn<SoloPlayer>[] = [
    {
      key: "expander",
      width: 56,
      render: (player) =>
        expandedUuid === player.playerUuid ? (
          <ChevronDown className="size-4" />
        ) : (
          <ChevronRight className="size-4" />
        ),
    },
    {
      key: "player",
      header: "Player",
      minWidth: 200,
      ...sortProps("player"),
      skeleton: () => (
        <div className="flex items-center gap-2">
          <Skeleton className="size-5 shrink-0 rounded-xs" />
          <Skeleton className="h-4 w-28" />
        </div>
      ),
      render: (player) => (
        <PlayerLabel
          uuid={player.playerUuid}
          name={player.minecraftUsername ?? player.playerUuid}
          linkable={Boolean(player.minecraftUsername)}
          size={20}
        />
      ),
    },
    {
      key: "totalChunks",
      header: "Claimed",
      width: 115,
      ...sortProps("totalChunks"),
      cellClassName: "font-medium",
      render: (player) => player.totalChunks,
    },
    {
      key: "forceloadableChunks",
      header: "Forceloadable",
      width: 155,
      ...sortProps("forceloadableChunks"),
      render: (player) =>
        player.forceloadableChunks > 0 ? (
          <span className="font-medium">{player.forceloadableChunks}</span>
        ) : (
          <span className="text-muted-foreground">0</span>
        ),
    },
    {
      key: "activeChunks",
      header: "Active",
      width: 105,
      ...sortProps("activeChunks"),
      render: (player) =>
        player.activeChunks > 0 ? (
          <span className="font-medium text-success">
            {player.activeChunks}
          </span>
        ) : (
          <span className="text-muted-foreground">0</span>
        ),
    },
    {
      key: "allyStatus",
      header: "Ally status",
      width: 130,
      ...sortProps("allyStatus"),
      skeleton: () => <BadgeCellSkeleton />,
      render: (player) =>
        player.allyStatus === "allied" ? (
          <Badge
            variant="outline"
            className="border-blue-500 bg-blue-500/10 text-blue-400"
          >
            Allied
          </Badge>
        ) : player.allyStatus === "pending" ? (
          <Badge
            variant="outline"
            className="border-amber-500 bg-amber-500/10 text-amber-500"
          >
            Pending
          </Badge>
        ) : null,
    },
    {
      key: "lastSyncedAt",
      header: "Last synced",
      width: 140,
      ...sortProps("lastSyncedAt"),
      cellClassName: "text-muted-foreground",
      render: (player) =>
        player.lastSyncedAt && (
          <CellText
            value={formatFullDateSafe(player.lastSyncedAt)}
            display={formatRelativeDateSafe(player.lastSyncedAt)}
          />
        ),
    },
  ];

  const total = data?.pagination.total ?? 0;
  const totalPages = data?.pagination.totalPages ?? 0;
  const loadingRows = loadingRowCount(page, PLAYERS_PER_PAGE, total);

  if (!isLoading && total === 0) return null;

  return (
    <div className="flex flex-col gap-3 px-0 pb-3">
      <DataTable
        columns={columns}
        rows={data?.items ?? []}
        loading={isLoading}
        loadingRows={loadingRows}
        rowKey={(player) => player.playerUuid}
        onRowClick={(player) =>
          setExpandedUuid(
            expandedUuid === player.playerUuid ? null : player.playerUuid,
          )
        }
        expandedKey={expandedUuid}
        renderExpanded={(player) => (
          <SoloPlayerChunks
            serverId={serverId}
            playerUuid={player.playerUuid}
            dimensionFilter={dimensionFilter}
            activeOnly={activeOnly}
          />
        )}
      />
      <Paginator
        page={page}
        limit={PLAYERS_PER_PAGE}
        total={total}
        totalPages={totalPages}
        onPageChange={onPageChange}
        itemLabel="player"
        className="px-4"
      />
    </div>
  );
}

function SoloPlayerChunks({
  serverId,
  playerUuid,
  dimensionFilter,
  activeOnly,
}: {
  serverId: number;
  playerUuid: string;
  dimensionFilter: DimensionFilter;
  activeOnly: boolean;
}) {
  const filtersKey = `${dimensionFilter}|${activeOnly}`;
  const [page, setPage] = useState(0);
  const [prevFiltersKey, setPrevFiltersKey] = useState(filtersKey);
  if (prevFiltersKey !== filtersKey) {
    setPrevFiltersKey(filtersKey);
    setPage(0);
  }
  const [sort, setSort] = useState<ChunkSortState>(null);

  const handleSortChange = useCallback((field: ChunkSortField) => {
    setSort((prev) =>
      prev?.field === field
        ? { field, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { field, direction: "asc" },
    );
    setPage(0);
  }, []);

  const chunksQuery = trpc.admin.parties.chunkPlayerDetail.useQuery({
    serverId,
    playerUuid,
    page,
    limit: CHUNKS_PER_PAGE,
    dimension: dimensionFilter === "all" ? undefined : dimensionFilter,
    activeOnly: activeOnly || undefined,
    sortBy: sort?.field,
    sortDir: sort?.direction,
  });

  if (chunksQuery.isLoading) return <Loading size="small" />;
  if (!chunksQuery.data) return null;

  const hasActiveFilters = dimensionFilter !== "all" || activeOnly;

  return (
    <div className="flex flex-col gap-3">
      <ChunkDetailTable
        chunks={chunksQuery.data.items}
        hasActiveFilters={hasActiveFilters}
        sort={sort}
        onSortChange={handleSortChange}
      />
      <Paginator
        page={chunksQuery.data.pagination.page}
        limit={chunksQuery.data.pagination.limit}
        total={chunksQuery.data.pagination.total}
        totalPages={chunksQuery.data.pagination.totalPages}
        onPageChange={setPage}
        itemLabel="chunk"
      />
    </div>
  );
}
