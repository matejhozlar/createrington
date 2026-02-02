import { useCallback, useEffect, useState } from "react";
import { Loading } from "@/components/Loading";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, FileText } from "lucide-react";
import type { GetPlayerAuditLogResponse } from "@createrington/shared/api";
import type { AdminLogActionApiData } from "@createrington/shared/db";

interface AuditTabProps {
  playerId: string; // minecraftUuid (route param)
}

export function AuditTab({ playerId }: AuditTabProps) {
  const [actions, setActions] = useState<AdminLogActionApiData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [page, setPage] = useState(0);
  const [limit] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const loadAuditLog = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem("auth_token");
      if (!token) throw new Error("No authentication token");

      const response = await fetch(
        `/api/admin/players/${playerId}/audit-log?page=${page}&limit=${limit}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: GetPlayerAuditLogResponse = await response.json();

      if (data.success) {
        setActions(data.data.actions);
        setTotal(data.data.pagination.total);
        setTotalPages(data.data.pagination.totalPages);
      }
    } catch (err) {
      console.error("Failed to load audit log:", err);
      setError(err instanceof Error ? err.message : "Failed to load audit log");
    } finally {
      setLoading(false);
    }
  }, [playerId, page, limit]);

  useEffect(() => {
    loadAuditLog();
  }, [loadAuditLog]);

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  const getActionBadgeVariant = (actionType: string) => {
    if (actionType.includes("delete") || actionType.includes("deduct")) {
      return "destructive";
    }
    if (actionType.includes("create") || actionType.includes("grant")) {
      return "default";
    }
    return "outline";
  };

  const formatValue = (value: string | null): string => {
    if (value === null) return "—";
    try {
      const parsed = JSON.parse(value);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return value;
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Admin Action History</h3>
          <p className="text-sm text-muted-foreground">
            {total.toLocaleString()} total actions
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={loadAuditLog}
          disabled={loading}
          className="cursor-pointer"
        >
          <FileText className="size-4" />
          {loading ? "Loading..." : "Refresh"}
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loading size="medium" text="Loading audit log..." />
        </div>
      ) : error ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <p className="text-destructive">{error}</p>
            <Button
              onClick={loadAuditLog}
              className="mt-4 cursor-pointer"
              variant="outline"
            >
              Try Again
            </Button>
          </div>
        </div>
      ) : actions.length === 0 ? (
        <div className="py-12 text-center">
          <FileText className="mx-auto size-12 text-muted-foreground" />
          <p className="mt-2 text-muted-foreground">
            No audit log entries found
          </p>
        </div>
      ) : (
        <>
          {/* Actions list */}
          <div className="space-y-2">
            {actions.map((action) => (
              <div
                key={action.id}
                className="rounded-lg border border-border p-4 transition-colors hover:bg-sidebar-accent/30"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={getActionBadgeVariant(action.actionType)}>
                        {action.actionType}
                      </Badge>
                      <Badge variant="outline">{action.tableName}</Badge>
                      {action.serverId && (
                        <Badge variant="outline">
                          Server {action.serverId}
                        </Badge>
                      )}
                    </div>

                    <div className="mt-2 space-y-1">
                      <p className="text-sm">
                        <span className="font-medium">Field:</span>{" "}
                        <code className="rounded bg-muted px-1 py-0.5 text-xs">
                          {action.fieldName}
                        </code>
                      </p>

                      {action.oldValue !== null && (
                        <p className="text-sm">
                          <span className="font-medium">Old Value:</span>{" "}
                          <code className="rounded bg-muted px-1 py-0.5 text-xs">
                            {formatValue(action.oldValue)}
                          </code>
                        </p>
                      )}

                      {action.newValue !== null && (
                        <p className="text-sm">
                          <span className="font-medium">New Value:</span>{" "}
                          <code className="rounded bg-muted px-1 py-0.5 text-xs">
                            {formatValue(action.newValue)}
                          </code>
                        </p>
                      )}

                      {action.reason && (
                        <p className="text-sm">
                          <span className="font-medium">Reason:</span>{" "}
                          <span className="text-muted-foreground">
                            {action.reason}
                          </span>
                        </p>
                      )}

                      {action.metadata &&
                        Object.keys(action.metadata).length > 0 && (
                          <details className="mt-2">
                            <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
                              View Metadata
                            </summary>
                            <pre className="mt-1 rounded bg-muted p-2 text-xs">
                              {JSON.stringify(action.metadata, null, 2)}
                            </pre>
                          </details>
                        )}
                    </div>

                    <p className="mt-2 text-xs text-muted-foreground">
                      Performed by {action.adminDiscordUsername} on{" "}
                      {new Date(action.performedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border pt-4">
              <p className="text-sm text-muted-foreground">
                Showing {page * limit + 1} to{" "}
                {Math.min((page + 1) * limit, total)} of {total} actions
              </p>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page === 0}
                  className="cursor-pointer"
                >
                  <ChevronLeft className="size-4" />
                  Previous
                </Button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
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
                        onClick={() => handlePageChange(pageNum)}
                        className="cursor-pointer"
                      >
                        {pageNum + 1}
                      </Button>
                    );
                  })}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(page + 1)}
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
    </div>
  );
}
