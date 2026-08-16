import { CellDate, CellText } from "@/components/cell-text";
import {
  DataTable,
  loadingRowCount,
  TwoLineCellSkeleton,
  type DataTableColumn,
} from "@/components/data-table";
import { Paginator } from "@/components/paginator";
import { useState } from "react";
import { keepPreviousData } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";
import { trpc, type RouterOutput } from "@/lib/trpc";

interface SessionsTabProps {
  playerId: string;
  getServerName: (serverId: number) => string | null;
}

export function SessionsTab({ playerId, getServerName }: SessionsTabProps) {
  const [page, setPage] = useState(0);
  const [limit] = useState(10);

  const sessionsQuery = trpc.admin.players.sessions.list.useQuery(
    {
      id: playerId,
      page,
      limit,
    },
    { placeholderData: keepPreviousData },
  );

  const sessions = sessionsQuery.data?.sessions ?? [];
  const total = sessionsQuery.data?.pagination.total ?? 0;
  const totalPages = sessionsQuery.data?.pagination.totalPages ?? 0;
  const loading = sessionsQuery.isLoading || sessionsQuery.isPlaceholderData;
  const loadingRows = loadingRowCount(page, limit, total);
  const error = sessionsQuery.error?.message ?? null;

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
  };

  type Session =
    RouterOutput["admin"]["players"]["sessions"]["list"]["sessions"][number];

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
            <Badge
              variant="default"
              className="shrink-0 bg-green-500/20 text-green-500"
            >
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
              {duration > 0 ? formatDuration(duration) : "In progress"}
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Session History</h3>
          <p className="text-sm text-muted-foreground">
            {total.toLocaleString()} total
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => sessionsQuery.refetch()}
          disabled={loading}
        >
          <Clock className="size-4" />
          {loading ? "Loading..." : "Refresh"}
        </Button>
      </div>

      {error ? (
        <div className="py-12 text-center">
          <p className="text-destructive">{error}</p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => sessionsQuery.refetch()}
            className="mt-4"
          >
            Retry
          </Button>
        </div>
      ) : !loading && sessions.length === 0 ? (
        <div className="py-12 text-center">
          <Clock className="mx-auto size-12 text-muted-foreground" />
          <p className="mt-2 text-muted-foreground">No sessions found</p>
        </div>
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={sessions}
            loading={loading}
            loadingRows={loadingRows}
            rowKey={(session) => session.id}
          />

          <Paginator
            page={page}
            limit={limit}
            total={total}
            totalPages={totalPages}
            onPageChange={setPage}
            itemLabel="session"
            className="border-t border-border pt-4"
          />
        </>
      )}
    </div>
  );
}
