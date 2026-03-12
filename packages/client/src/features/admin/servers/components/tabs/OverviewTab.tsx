import { useNavigate } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { MinecraftAvatar } from "@/components/minecraft-avatar";
import { usePlayerData } from "@/contexts/player-data";
import type { RouterOutput } from "@/lib/trpc";

type ServerDetail = RouterOutput["admin"]["servers"]["get"];

interface OverviewTabProps {
  serverId: number;
  serverData: ServerDetail;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function OverviewTab({ serverId, serverData }: OverviewTabProps) {
  const navigate = useNavigate();
  const { getServerPlayers } = usePlayerData();

  const onlinePlayers = getServerPlayers(serverId);
  const leaderboard = serverData.leaderboard;

  return (
    <div className="flex flex-col gap-6">
      {/* Online Players */}
      <div>
        <h3 className="mb-3 text-lg font-semibold">
          Online Players ({onlinePlayers.length})
        </h3>
        {onlinePlayers.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No players currently online
          </p>
        ) : (
          <Table>
            <TableHeader className="bg-sidebar-accent/50">
              <TableRow>
                <TableHead className="px-4">Player</TableHead>
                <TableHead className="px-4">Session Duration</TableHead>
                <TableHead className="px-4 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {onlinePlayers.map((player) => (
                <TableRow key={player.uuid}>
                  <TableCell className="px-4">
                    <div className="flex items-center gap-3">
                      <MinecraftAvatar
                        uuid={player.uuid}
                        username={player.username}
                      />
                      <p className="font-medium">{player.username}</p>
                    </div>
                  </TableCell>
                  <TableCell className="px-4">
                    <p className="text-sm text-muted-foreground">
                      {formatDuration(player.sessionDuration)}
                    </p>
                  </TableCell>
                  <TableCell className="px-4 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(`/admin/players/${player.uuid}`)}
                      className="cursor-pointer"
                    >
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Leaderboard */}
      <div>
        <h3 className="mb-3 text-lg font-semibold">Top Players</h3>
        {leaderboard.length === 0 ? (
          <p className="text-sm text-muted-foreground">No playtime data yet</p>
        ) : (
          <Table>
            <TableHeader className="bg-sidebar-accent/50">
              <TableRow>
                <TableHead className="w-12 px-4">#</TableHead>
                <TableHead className="px-4">Player</TableHead>
                <TableHead className="px-4">Total Hours</TableHead>
                <TableHead className="px-4">Sessions</TableHead>
                <TableHead className="px-4">Last Seen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leaderboard.map((entry, index) => (
                <TableRow key={entry.playerMinecraftUuid}>
                  <TableCell className="px-4 font-medium">
                    {index + 1}
                  </TableCell>
                  <TableCell className="px-4">
                    <div className="flex items-center gap-3">
                      <MinecraftAvatar
                        uuid={entry.playerMinecraftUuid}
                        username={entry.minecraftUsername}
                      />
                      <button
                        type="button"
                        className="font-medium hover:underline cursor-pointer"
                        onClick={() =>
                          navigate(
                            `/admin/players/${entry.playerMinecraftUuid}`,
                          )
                        }
                      >
                        {entry.minecraftUsername}
                      </button>
                    </div>
                  </TableCell>
                  <TableCell className="px-4">
                    {Math.round(Number(entry.totalSeconds) / 3600)}h
                  </TableCell>
                  <TableCell className="px-4">{entry.totalSessions}</TableCell>
                  <TableCell className="px-4 text-sm text-muted-foreground">
                    {new Date(entry.lastSeen).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
