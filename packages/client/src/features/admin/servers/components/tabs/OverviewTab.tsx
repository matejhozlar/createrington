import { Link } from "react-router";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {onlinePlayers.map((player) => (
                <TableRow key={player.uuid}>
                  <TableCell className="px-4">
                    <Link
                      to={`/admin/players/${player.uuid}`}
                      className="group flex items-center gap-3 rounded"
                    >
                      <MinecraftAvatar
                        uuid={player.uuid}
                        username={player.username}
                      />
                      <span className="font-medium transition-colors group-hover:text-primary">
                        {player.username}
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell className="px-4">
                    <p className="text-sm text-muted-foreground">
                      {formatDuration(player.sessionDuration)}
                    </p>
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
                    <Link
                      to={`/admin/players/${entry.playerMinecraftUuid}`}
                      className="group flex items-center gap-3 rounded"
                    >
                      <MinecraftAvatar
                        uuid={entry.playerMinecraftUuid}
                        username={entry.minecraftUsername}
                      />
                      <span className="font-medium transition-colors group-hover:text-primary">
                        {entry.minecraftUsername}
                      </span>
                    </Link>
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
