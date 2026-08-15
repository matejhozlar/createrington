import { useState } from "react";
import { Link } from "react-router";
import { Badge } from "@/components/ui/badge";
import { CellDate, CellText } from "@/components/cell-text";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { Loading } from "@/components/loading-spinner";
import { Paginator } from "@/components/paginator";
import { MinecraftAvatar } from "@/components/minecraft-avatar";
import { trpc, type RouterOutput } from "@/lib/trpc";

interface SessionsTabProps {
  serverId: number;
}

type ServerSession =
  RouterOutput["admin"]["servers"]["sessions"]["sessions"][number];

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "Active";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

const COLUMNS: DataTableColumn<ServerSession>[] = [
  {
    key: "player",
    header: "Player",
    minWidth: 200,
    render: (session) => (
      <Link
        to={`/admin/players/${session.playerMinecraftUuid}`}
        className="group flex min-w-0 items-center gap-3 rounded"
      >
        <MinecraftAvatar
          uuid={session.playerMinecraftUuid}
          username={session.minecraftUsername}
        />
        <CellText
          value={session.minecraftUsername}
          className="font-medium transition-colors group-hover:text-primary"
        />
      </Link>
    ),
  },
  {
    key: "joined",
    header: "Joined",
    width: 120,
    render: (session) => <CellDate value={session.sessionStart} />,
  },
  {
    key: "left",
    header: "Left",
    width: 120,
    render: (session) =>
      session.sessionEnd ? (
        <CellDate value={session.sessionEnd} />
      ) : (
        <Badge variant="default" className="bg-green-500/20 text-green-500">
          Active
        </Badge>
      ),
  },
  {
    key: "duration",
    header: "Duration",
    width: 120,
    align: "right",
    cellClassName: "text-sm",
    render: (session) => formatDuration(session.secondsPlayed),
  },
];

export function SessionsTab({ serverId }: SessionsTabProps) {
  const [page, setPage] = useState(0);
  const limit = 20;

  const sessionsQuery = trpc.admin.servers.sessions.useQuery({
    serverId,
    page,
    limit,
  });

  const sessions = sessionsQuery.data?.sessions ?? [];
  const pagination = sessionsQuery.data?.pagination;
  const totalPages = pagination?.totalPages ?? 0;
  const total = pagination?.total ?? 0;
  const loading = sessionsQuery.isLoading;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loading size="medium" text="Loading sessions..." />
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <p className="text-center text-sm text-muted-foreground py-8">
        No sessions found for this server
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <DataTable
        columns={COLUMNS}
        rows={sessions}
        rowKey={(session) => session.id}
      />

      <Paginator
        page={page}
        limit={limit}
        total={total}
        totalPages={totalPages}
        onPageChange={setPage}
        itemLabel="session"
      />
    </div>
  );
}
