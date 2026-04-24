import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight, User } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Loading } from "@/components/loading-spinner";
import { PlayerLabel } from "@/components/player-label";
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
import { formatRelativeDate, formatFullDate } from "@/features/admin/format";
import type { DimensionFilter } from "../AdminForceloads";
import { ChunkTable } from "./ChunkTable";

interface Player {
  id: number;
  playerUuid: string;
  syncedAt: string;
  minecraftUsername: string | null;
  totalChunks: number;
  activeChunks: number;
}

function ChunkDetails({
  ownerId,
  dimensionFilter,
  activeOnly,
}: {
  ownerId: number;
  dimensionFilter: DimensionFilter;
  activeOnly: boolean;
}) {
  const chunksQuery = trpc.admin.forceloads.chunks.useQuery({
    ownerId,
    ownerType: "player",
  });

  if (chunksQuery.isLoading) return <Loading size="small" />;
  if (!chunksQuery.data) return null;

  return (
    <ChunkTable
      chunks={chunksQuery.data}
      dimensionFilter={dimensionFilter}
      activeOnly={activeOnly}
    />
  );
}

export function PlayerForceloadsTable({
  players,
  search,
  dimensionFilter,
  activeOnly,
}: {
  players: Player[];
  search: string;
  dimensionFilter: DimensionFilter;
  activeOnly: boolean;
}) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const needle = search.trim().toLowerCase();
  const filtered = needle
    ? players.filter((p) =>
        (p.minecraftUsername ?? p.playerUuid).toLowerCase().includes(needle),
      )
    : players;

  if (players.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-2 py-12">
          <User className="size-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No solo player forceloads on this server
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="gap-0">
      <CardHeader className="border-b">
        <CardTitle>
          Solo Players ({filtered.length}
          {filtered.length !== players.length && ` of ${players.length}`})
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Player</TableHead>
              <TableHead>Total Chunks</TableHead>
              <TableHead>Active Chunks</TableHead>
              <TableHead>Last Synced</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-6 text-center text-sm text-muted-foreground"
                >
                  No players match "{search}"
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((player) => {
                const isExpanded = expandedId === player.id;
                const resolved = Boolean(player.minecraftUsername);
                const displayName =
                  player.minecraftUsername ?? player.playerUuid;

                return (
                  <Fragment key={player.id}>
                    <TableRow
                      className="cursor-pointer"
                      onClick={() =>
                        setExpandedId(isExpanded ? null : player.id)
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
                          linkable={resolved}
                        />
                      </TableCell>
                      <TableCell>{player.totalChunks}</TableCell>
                      <TableCell>{player.activeChunks}</TableCell>
                      <TableCell className="text-muted-foreground">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>{formatRelativeDate(player.syncedAt)}</span>
                          </TooltipTrigger>
                          <TooltipContent>
                            {formatFullDate(player.syncedAt)}
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow>
                        <TableCell colSpan={5} className="bg-muted/30 p-4">
                          <ChunkDetails
                            ownerId={player.id}
                            dimensionFilter={dimensionFilter}
                            activeOnly={activeOnly}
                          />
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
