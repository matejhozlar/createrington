import {
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { CellDate, CellText } from "@/components/cell-text";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { cn } from "@/lib/utils";
import { useCallback, useState } from "react";
import { Loading } from "@/components/loading-spinner";
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

  const sessionsQuery = trpc.admin.players.sessions.list.useQuery({
    id: playerId,
    page,
    limit,
  });

  const sessions = sessionsQuery.data?.sessions ?? [];
  const total = sessionsQuery.data?.pagination.total ?? 0;
  const totalPages = sessionsQuery.data?.pagination.totalPages ?? 0;
  const loading = sessionsQuery.isLoading;
  const error = sessionsQuery.error?.message ?? null;

  const getPaginationItems = useCallback(() => {
    const items: (number | "ellipsis")[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      return Array.from({ length: totalPages }, (_, i) => i);
    }

    items.push(0);

    if (page <= 2) {
      items.push(1, 2, 3);
      items.push("ellipsis");
      items.push(totalPages - 1);
    } else if (page >= totalPages - 3) {
      items.push("ellipsis");
      items.push(
        totalPages - 4,
        totalPages - 3,
        totalPages - 2,
        totalPages - 1,
      );
    } else {
      items.push("ellipsis");
      items.push(page - 1, page, page + 1);
      items.push("ellipsis");
      items.push(totalPages - 1);
    }

    return items;
  }, [page, totalPages]);

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

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loading size="medium" text="Loading sessions..." />
        </div>
      ) : error ? (
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
      ) : sessions.length === 0 ? (
        <div className="py-12 text-center">
          <Clock className="mx-auto size-12 text-muted-foreground" />
          <p className="mt-2 text-muted-foreground">No sessions found</p>
        </div>
      ) : (
        <>
          {/* Table */}
          <DataTable
            columns={columns}
            rows={sessions}
            rowKey={(session) => session.id}
          />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center gap-4 border-t border-border pt-4">
              <p className="flex-1 text-sm text-muted-foreground">
                Showing {page * limit + 1}-{Math.min((page + 1) * limit, total)}{" "}
                of {total} sessions
              </p>

              {/* No <Pagination /> wrapper, it centers by default */}
              <PaginationContent className="ml-auto flex-nowrap justify-end">
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (page > 0) setPage(page - 1);
                    }}
                    className={cn(
                      page === 0 && "pointer-events-none opacity-50",
                    )}
                  />
                </PaginationItem>

                {getPaginationItems().map((item, index) => (
                  <PaginationItem
                    key={item === "ellipsis" ? `ellipsis-${index}` : item}
                  >
                    {item === "ellipsis" ? (
                      <PaginationEllipsis />
                    ) : (
                      <PaginationLink
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          setPage(item);
                        }}
                        isActive={page === item}
                      >
                        {item + 1}
                      </PaginationLink>
                    )}
                  </PaginationItem>
                ))}

                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (page < totalPages - 1) setPage(page + 1);
                    }}
                    className={cn(
                      page >= totalPages - 1 &&
                        "pointer-events-none opacity-50",
                    )}
                  />
                </PaginationItem>
              </PaginationContent>
            </div>
          )}
        </>
      )}
    </div>
  );
}
