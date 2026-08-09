import { useState } from "react";
import { Link } from "react-router";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loading } from "@/components/loading-spinner";
import { Paginator } from "@/components/paginator";
import { MinecraftAvatar } from "@/components/minecraft-avatar";
import { trpc } from "@/lib/trpc";

interface SessionsTabProps {
  serverId: number;
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "Active";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

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
      <Table className="min-w-[620px]">
        <TableHeader>
          <TableRow>
            <TableHead>Player</TableHead>
            <TableHead col="dateTime">Joined</TableHead>
            <TableHead col="dateTime">Left</TableHead>
            <TableHead col="duration">Duration</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sessions.map((session) => (
            <TableRow key={session.id}>
              <TableCell>
                <Link
                  to={`/admin/players/${session.playerMinecraftUuid}`}
                  className="group flex min-w-0 items-center gap-3 rounded"
                >
                  <MinecraftAvatar
                    uuid={session.playerMinecraftUuid}
                    username={session.minecraftUsername}
                  />
                  <span className="truncate font-medium transition-colors group-hover:text-primary">
                    {session.minecraftUsername}
                  </span>
                </Link>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {new Date(session.sessionStart).toLocaleString()}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {session.sessionEnd
                  ? new Date(session.sessionEnd).toLocaleString()
                  : "Active"}
              </TableCell>
              <TableCell className="text-sm">
                {formatDuration(session.secondsPlayed)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

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
