import { Link } from "react-router";
import { CellDate, CellText } from "@/components/cell-text";
import { DataTable, type DataTableColumn } from "@/components/data-table";
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

function PlayerCell({ uuid, username }: { uuid: string; username: string }) {
  return (
    <Link
      to={`/admin/players/${uuid}`}
      className="group flex min-w-0 items-center gap-3 rounded"
    >
      <MinecraftAvatar uuid={uuid} username={username} />
      <CellText
        value={username}
        className="font-medium transition-colors group-hover:text-primary"
      />
    </Link>
  );
}

export function OverviewTab({ serverId, serverData }: OverviewTabProps) {
  const { getServerPlayers } = usePlayerData();

  const onlinePlayers = getServerPlayers(serverId);
  const leaderboard = serverData.leaderboard;

  const onlineColumns: DataTableColumn<(typeof onlinePlayers)[number]>[] = [
    {
      key: "player",
      header: "Player",
      minWidth: 200,
      render: (player) => (
        <PlayerCell uuid={player.uuid} username={player.username} />
      ),
    },
    {
      key: "duration",
      header: "Session Duration",
      width: 170,
      cellClassName: "text-sm text-muted-foreground",
      render: (player) => formatDuration(player.sessionDuration),
    },
  ];

  const leaderboardColumns: DataTableColumn<(typeof leaderboard)[number]>[] = [
    {
      key: "rank",
      header: "#",
      width: 60,
      cellClassName: "font-medium",
      render: (_entry, index) => index + 1,
    },
    {
      key: "player",
      header: "Player",
      minWidth: 200,
      render: (entry) => (
        <PlayerCell
          uuid={entry.playerMinecraftUuid}
          username={entry.minecraftUsername}
        />
      ),
    },
    {
      key: "hours",
      header: "Total Hours",
      width: 130,
      render: (entry) => `${Math.round(Number(entry.totalSeconds) / 3600)}h`,
    },
    {
      key: "sessions",
      header: "Sessions",
      width: 110,
      render: (entry) => entry.totalSessions,
    },
    {
      key: "lastSeen",
      header: "Last Seen",
      width: 120,
      render: (entry) => <CellDate value={entry.lastSeen} />,
    },
  ];

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
          <DataTable
            columns={onlineColumns}
            rows={onlinePlayers}
            rowKey={(player) => player.uuid}
          />
        )}
      </div>

      {/* Leaderboard */}
      <div>
        <h3 className="mb-3 text-lg font-semibold">Top Players</h3>
        {leaderboard.length === 0 ? (
          <p className="text-sm text-muted-foreground">No playtime data yet</p>
        ) : (
          <DataTable
            columns={leaderboardColumns}
            rows={leaderboard}
            rowKey={(entry) => entry.playerMinecraftUuid}
          />
        )}
      </div>
    </div>
  );
}
