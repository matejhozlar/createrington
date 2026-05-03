import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Loading } from "@/components/loading-spinner";
import { Paginator } from "@/components/paginator";
import { PlayerLabel } from "@/components/player-label";
import {
  formatFullDateSafe,
  formatRelativeDateSafe,
} from "@/features/admin/format";
import { trpc } from "@/lib/trpc";
import type { RouterOutput } from "@/lib/trpc";
import type { DimensionFilter } from "../types";
import { ChunkDetailTable } from "./ChunkDetailTable";

export type SoloPlayersData =
  RouterOutput["admin"]["parties"]["chunkSoloPlayers"];
type SoloPlayer = SoloPlayersData["items"][number];

const CHUNKS_PER_PAGE = 50;

export function ChunkSoloPlayersSection({
  serverId,
  data,
  isLoading,
  onPageChange,
  dimensionFilter,
  activeOnly,
}: {
  serverId: number;
  data: SoloPlayersData | undefined;
  isLoading: boolean;
  onPageChange: (page: number) => void;
  dimensionFilter: DimensionFilter;
  activeOnly: boolean;
}) {
  if (isLoading) {
    return <Loading size="medium" text="Loading solo players..." />;
  }
  if (!data || data.pagination.total === 0) return null;

  return (
    <div className="flex flex-col gap-3 px-0 pb-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8" />
            <TableHead>Player</TableHead>
            <TableHead>Claimed</TableHead>
            <TableHead>Forceloadable</TableHead>
            <TableHead>Active</TableHead>
            <TableHead>Ally status</TableHead>
            <TableHead>Last synced</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.items.map((player) => (
            <SoloPlayerRow
              key={player.playerUuid}
              serverId={serverId}
              player={player}
              dimensionFilter={dimensionFilter}
              activeOnly={activeOnly}
            />
          ))}
        </TableBody>
      </Table>
      <Paginator
        page={data.pagination.page}
        limit={data.pagination.limit}
        total={data.pagination.total}
        totalPages={data.pagination.totalPages}
        onPageChange={onPageChange}
        itemLabel="player"
        className="px-4"
      />
    </div>
  );
}

function SoloPlayerRow({
  serverId,
  player,
  dimensionFilter,
  activeOnly,
}: {
  serverId: number;
  player: SoloPlayer;
  dimensionFilter: DimensionFilter;
  activeOnly: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const displayName = player.minecraftUsername ?? player.playerUuid;

  return (
    <Fragment>
      <TableRow
        className="cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        <TableCell>
          {expanded ? (
            <ChevronDown className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          )}
        </TableCell>
        <TableCell>
          <PlayerLabel
            uuid={player.playerUuid}
            name={displayName}
            linkable={Boolean(player.minecraftUsername)}
            size={20}
          />
        </TableCell>
        <TableCell className="font-medium">{player.totalChunks}</TableCell>
        <TableCell>
          {player.forceloadableChunks > 0 ? (
            <span className="font-medium">{player.forceloadableChunks}</span>
          ) : (
            <span className="text-muted-foreground">0</span>
          )}
        </TableCell>
        <TableCell>
          {player.activeChunks > 0 ? (
            <span className="font-medium text-success">
              {player.activeChunks}
            </span>
          ) : (
            <span className="text-muted-foreground">0</span>
          )}
        </TableCell>
        <TableCell>
          {player.allyStatus === "allied" ? (
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
          ) : (
            <span className="text-muted-foreground">&mdash;</span>
          )}
        </TableCell>
        <TableCell className="text-muted-foreground">
          <Tooltip>
            <TooltipTrigger asChild>
              <span>{formatRelativeDateSafe(player.lastSyncedAt)}</span>
            </TooltipTrigger>
            <TooltipContent>
              {formatFullDateSafe(player.lastSyncedAt)}
            </TooltipContent>
          </Tooltip>
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow>
          <TableCell colSpan={7} className="bg-muted/30 p-4">
            <SoloPlayerChunks
              serverId={serverId}
              playerUuid={player.playerUuid}
              dimensionFilter={dimensionFilter}
              activeOnly={activeOnly}
            />
          </TableCell>
        </TableRow>
      )}
    </Fragment>
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

  const chunksQuery = trpc.admin.parties.chunkPlayerDetail.useQuery({
    serverId,
    playerUuid,
    page,
    limit: CHUNKS_PER_PAGE,
    dimension: dimensionFilter === "all" ? undefined : dimensionFilter,
    activeOnly: activeOnly || undefined,
  });

  if (chunksQuery.isLoading) return <Loading size="small" />;
  if (!chunksQuery.data) return null;

  const hasActiveFilters = dimensionFilter !== "all" || activeOnly;

  return (
    <div className="flex flex-col gap-3">
      <ChunkDetailTable
        chunks={chunksQuery.data.items}
        hasActiveFilters={hasActiveFilters}
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
