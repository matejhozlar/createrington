import { formatCompactDuration } from "@createrington/shared/format";
import { CellDate, CellText } from "@/components/cell-text";
import {
  TwoLineCellSkeleton,
  type DataTableColumn,
} from "@/components/data-table";
import { PagedTable } from "@/components/paged-table";
import { usePagedQuery } from "@/hooks/use-paged-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";
import { trpc, type RouterOutput } from "@/lib/trpc";

interface SessionsTabProps {
  playerId: string;
  getServerName: (serverId: number) => string | null;
}

export function SessionsTab({ playerId, getServerName }: SessionsTabProps) {
  const sessions = usePagedQuery(
    { id: playerId },
    (input) => trpc.admin.players.sessions.list.queryOptions(input),
    10,
  );

  type Session =
    RouterOutput["admin"]["players"]["sessions"]["list"]["items"][number];

  const columns: DataTableColumn<Session>[] = [
    {
      key: "server",
      header: "Server",
      minWidth: 180,
      render: (session) => (
        <div className="flex min-w-0 items-center gap-2">
          <CellText
            value={getServerName(session.serverId) ?? ""}
            className="font-medium"
          />
          {!session.sessionEnd && (
            <Badge tone="success" className="shrink-0">
              Active
            </Badge>
          )}
        </div>
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
        session.sessionEnd && <CellDate value={session.sessionEnd} />,
    },
    {
      key: "duration",
      header: "Duration",
      width: 160,
      align: "right",
      skeleton: () => (
        <TwoLineCellSkeleton className="flex flex-col items-end" />
      ),
      render: (session) => {
        const duration = session.secondsPlayed
          ? Number(session.secondsPlayed)
          : 0;
        return (
          <>
            <p className="font-semibold">
              {duration > 0 ? formatCompactDuration(duration) : "In progress"}
            </p>
            <p className="text-xs text-muted-foreground">
              Session #{session.id}
            </p>
          </>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Session History</h3>
          <p className="text-sm text-muted-foreground">
            {sessions.total.toLocaleString()} total
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={sessions.retry}
          loading={sessions.loading}
        >
          <Clock className="size-4" />
          Refresh
        </Button>
      </div>

      <PagedTable
        paged={sessions}
        empty={{ icon: Clock, message: "No sessions found" }}
        itemLabel="session"
        columns={columns}
        rowKey={(session) => session.id}
      />
    </div>
  );
}
