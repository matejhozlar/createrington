import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight, Users } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Loading } from "@/components/loading-spinner";
import { MinecraftAvatar } from "@/components/minecraft-avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Player {
  id: number;
  playerUuid: string;
  syncedAt: string;
  minecraftUsername: string | null;
  totalChunks: number;
  activeChunks: number;
}

function ChunkDetails({ ownerId }: { ownerId: number }) {
  const chunksQuery = trpc.admin.forceloads.chunks.useQuery({
    ownerId,
    ownerType: "player",
  });

  if (chunksQuery.isLoading) return <Loading size="small" />;
  if (!chunksQuery.data?.length) {
    return (
      <p className="py-2 text-sm text-muted-foreground">No chunks found</p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Dimension</TableHead>
          <TableHead>X</TableHead>
          <TableHead>Z</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {chunksQuery.data.map((chunk) => (
          <TableRow key={chunk.id}>
            <TableCell className="font-mono text-xs">
              {chunk.dimension}
            </TableCell>
            <TableCell className="font-mono text-xs">{chunk.x}</TableCell>
            <TableCell className="font-mono text-xs">{chunk.z}</TableCell>
            <TableCell>
              <Badge
                variant="outline"
                className={
                  chunk.active
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-500"
                    : "border-muted-foreground bg-muted-foreground/10 text-muted-foreground"
                }
              >
                {chunk.active ? "Active" : "Inactive"}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function PlayerForceloadsTable({ players }: { players: Player[] }) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  if (players.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-2 py-12">
          <Users className="size-10 text-muted-foreground" />
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
        <CardTitle>Solo Players ({players.length})</CardTitle>
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
            {players.map((player) => {
              const isExpanded = expandedId === player.id;
              const displayName = player.minecraftUsername ?? player.playerUuid;

              return (
                <Fragment key={player.id}>
                  <TableRow
                    className="cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : player.id)}
                  >
                    <TableCell>
                      {isExpanded ? (
                        <ChevronDown className="size-4" />
                      ) : (
                        <ChevronRight className="size-4" />
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <MinecraftAvatar
                          username={displayName}
                          uuid={player.playerUuid}
                          size={24}
                        />
                        <span className="font-medium">{displayName}</span>
                      </div>
                    </TableCell>
                    <TableCell>{player.totalChunks}</TableCell>
                    <TableCell>{player.activeChunks}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(player.syncedAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                  {isExpanded && (
                    <TableRow>
                      <TableCell colSpan={5} className="bg-muted/30 p-4">
                        <ChunkDetails ownerId={player.id} />
                      </TableCell>
                    </TableRow>
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
