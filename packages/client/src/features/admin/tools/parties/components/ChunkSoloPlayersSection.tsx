import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { PlayerLabel } from "@/components/player-label";
import {
  formatFullDateSafe,
  formatRelativeDateSafe,
} from "@/features/admin/format";
import { trpc } from "@/lib/trpc";
import type { RouterOutput } from "@/lib/trpc";
import type { DimensionFilter, PartyFilters } from "../types";
import { ChunkDetailTable } from "./ChunkDetailTable";

type SoloPlayer = RouterOutput["admin"]["parties"]["chunkSoloPlayers"][number];

export function ChunkSoloPlayersSection({
  serverId,
  players,
  filters,
}: {
  serverId: number;
  players: SoloPlayer[];
  filters: PartyFilters;
}) {
  const [expandedUuid, setExpandedUuid] = useState<string | null>(null);

  const needle = filters.search.trim().toLowerCase();

  const filtered = useMemo(
    () =>
      players.filter((p) => {
        if (filters.activeForceloadsOnly && p.activeChunks === 0) return false;
        if (filters.allied === "allied") return false;
        if (filters.optedIn !== "all") return false;
        if (
          needle &&
          !(p.minecraftUsername ?? p.playerUuid).toLowerCase().includes(needle)
        )
          return false;
        return true;
      }),
    [players, filters, needle],
  );

  if (filtered.length === 0) return null;

  return (
    <Card className="gap-0">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <User className="size-4 text-muted-foreground" />
          Solo players ({filtered.length}
          {filtered.length !== players.length && ` of ${players.length}`})
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Player</TableHead>
              <TableHead>Claimed</TableHead>
              <TableHead>Forceloadable</TableHead>
              <TableHead>Active</TableHead>
              <TableHead>Last synced</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((player) => {
              const isExpanded = expandedUuid === player.playerUuid;
              const displayName = player.minecraftUsername ?? player.playerUuid;
              return (
                <Fragment key={player.playerUuid}>
                  <TableRow
                    className="cursor-pointer"
                    onClick={() =>
                      setExpandedUuid(isExpanded ? null : player.playerUuid)
                    }
                  >
                    <TableCell>
                      {isExpanded ? (
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
                    <TableCell className="font-medium">
                      {player.totalChunks}
                    </TableCell>
                    <TableCell>
                      {player.forceloadableChunks > 0 ? (
                        <span className="font-medium">
                          {player.forceloadableChunks}
                        </span>
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
                    <TableCell className="text-muted-foreground">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>
                            {formatRelativeDateSafe(player.lastSyncedAt)}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          {formatFullDateSafe(player.lastSyncedAt)}
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                  {isExpanded && (
                    <SoloPlayerChunks
                      serverId={serverId}
                      playerUuid={player.playerUuid}
                      dimensionFilter={filters.dimension}
                      activeOnly={filters.activeForceloadsOnly}
                    />
                  )}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
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
  const chunksQuery = trpc.admin.parties.chunkPlayerDetail.useQuery({
    serverId,
    playerUuid,
  });

  return (
    <TableRow>
      <TableCell colSpan={6} className="bg-muted/30 p-4">
        {chunksQuery.isLoading ? (
          <Loading size="small" />
        ) : chunksQuery.data ? (
          <ChunkDetailTable
            chunks={chunksQuery.data}
            dimensionFilter={dimensionFilter}
            activeOnly={activeOnly}
          />
        ) : null}
      </TableCell>
    </TableRow>
  );
}
