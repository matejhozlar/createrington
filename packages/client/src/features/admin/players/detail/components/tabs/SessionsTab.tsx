import { useCallback, useEffect, useState } from "react";
import { Loading } from "@/components/Loading";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, ChevronLeft, ChevronRight } from "lucide-react";
import type { GetPlayerSessionsResponse } from "@createrington/shared/api";
import type { PlayerSessionApiData } from "@createrington/shared/db";

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

  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem("auth_token");
      if (!token) {
        throw new Error("No authentication token");
      }

      const response = await fetch(
        `/api/admin/players/${playerId}/sessions?page=${page}&limit=${limit}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: GetPlayerSessionsResponse = await response.json();

      if (data.success) {
        setSessions(data.data.sessions);
        setTotal(data.data.pagination.total);
        setTotalPages(data.data.pagination.totalPages);
      }
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
            <div className="flex items-center justify-between border-t border-border p-4">
              <p className="text-sm text-muted-foreground">
                Showing {page * limit + 1} to{" "}
                {Math.min((page + 1) * limit, total)} of {total} sessions
              </p>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={page === 0}
                  className="cursor-pointer"
                >
                  <ChevronLeft className="size-4" />
                  Previous
                </Button>

                <div className="flex items-center gap-1">
                  {Array.from(
                    {
                      length: Math.min(5, totalPages),
                    },
                    (_, i) => {
                      const pageNum =
                        totalPages <= 5
                          ? i
                          : page < 3
                            ? i
                            : page > totalPages - 4
                              ? totalPages - 5 + i
                              : page - 2 + i;

                      return (
                        <Button
                          key={pageNum}
                          variant={page === pageNum ? "default" : "outline"}
                          size="sm"
                          onClick={() => setPage(pageNum)}
                          className="cursor-pointer"
                        >
                          {pageNum + 1}
                        </Button>
                      );
                    },
                  )}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={page >= totalPages - 1}
                  className="cursor-pointer"
                >
                  Next
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
