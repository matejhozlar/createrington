import {
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { cn } from "@/lib/utils";
import { useCallback, useEffect, useState } from "react";
import { Loading } from "@/components/Loading";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";
import type { PlayerSessionApiData } from "@createrington/shared/db";
import { adminPlayerApi } from "@/services/api/admin/admin-players";

interface SessionsTabProps {
  playerId: string;
  getServerName: (serverId: number) => string | null;
}

export function SessionsTab({ playerId, getServerName }: SessionsTabProps) {
  const [sessions, setSessions] = useState<PlayerSessionApiData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [limit] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

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

  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await adminPlayerApi.getSessions(playerId, {
        page,
        limit,
      });

      setSessions(data.sessions);
      setTotal(data.pagination.total);
      setTotalPages(data.pagination.totalPages);
    } catch (err) {
      console.error("Failed to fetch sessions:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch sessions");
    } finally {
      setLoading(false);
    }
  }, [playerId, page, limit]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

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

  return (
    <>
      {/* Header */}
      <div className="border-b border-border p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">
            Session History ({total.toLocaleString()})
          </h2>
          <Button
            size="sm"
            variant="outline"
            onClick={fetchSessions}
            disabled={loading}
            className="cursor-pointer"
          >
            <Clock className="size-4" />
            {loading ? "Loading..." : "Refresh"}
          </Button>
        </div>
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
            onClick={fetchSessions}
            className="mt-4 cursor-pointer"
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
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-border bg-sidebar-accent/50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium">
                    Server
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium">
                    Joined
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium">
                    Left
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium">
                    Duration
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sessions.map((session) => {
                  const serverName = getServerName(session.serverId);
                  const duration = session.secondsPlayed
                    ? session.secondsPlayed
                    : 0;
                  const joinedAt = new Date(session.sessionStart);
                  const leftAt = session.sessionEnd
                    ? new Date(session.sessionEnd)
                    : null;

                  return (
                    <tr
                      key={session.id}
                      className="transition-colors hover:bg-sidebar-accent/30"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{serverName}</p>
                          {!leftAt && (
                            <Badge
                              variant="default"
                              className="bg-green-500/20 text-green-500"
                            >
                              Active
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-foreground">
                          {joinedAt.toLocaleDateString()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {joinedAt.toLocaleTimeString()}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        {leftAt ? (
                          <>
                            <p className="text-sm text-foreground">
                              {leftAt.toLocaleDateString()}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {leftAt.toLocaleTimeString()}
                            </p>
                          </>
                        ) : (
                          <p className="text-sm text-muted-foreground">—</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <p className="font-semibold">
                          {duration > 0
                            ? formatDuration(Number(duration))
                            : "In progress"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Session #{session.id}
                        </p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center gap-4 border-t border-border p-4">
              <p className="flex-1 text-sm text-muted-foreground">
                Showing {page * limit + 1}-{Math.min((page + 1) * limit, total)}{" "}
                of {total} sessions
              </p>

              {/* No <Pagination /> wrapper — it centers by default */}
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
                      "cursor-pointer",
                    )}
                  />
                </PaginationItem>

                {getPaginationItems().map((item, index) => (
                  <PaginationItem key={index}>
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
                        className="cursor-pointer"
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
                      "cursor-pointer",
                    )}
                  />
                </PaginationItem>
              </PaginationContent>
            </div>
          )}
        </>
      )}
    </>
  );
}
