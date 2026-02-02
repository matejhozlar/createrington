import { useCallback, useEffect, useState } from "react";
import { Loading } from "@/components/Loading";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Ticket } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TicketApiData } from "@createrington/shared/db";
import type { GetPlayerTicketsResponse } from "@createrington/shared/api";

interface TicketsTabProps {
  playerId: string; // minecraftUuid (route param)
}

export function TicketsTab({ playerId }: TicketsTabProps) {
  const [tickets, setTickets] = useState<TicketApiData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination state (same pattern as your players list)
  const [page, setPage] = useState(0);
  const [limit] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const loadTickets = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem("auth_token");
      if (!token) throw new Error("No authentication token");

      const response = await fetch(
        `/api/admin/players/${playerId}/tickets?page=${page}&limit=${limit}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: GetPlayerTicketsResponse = await response.json();

      if (data.success) {
        setTickets(data.data.tickets);
        setTotal(data.data.pagination.total);
        setTotalPages(data.data.pagination.totalPages);
      }
    } catch (err) {
      console.error("Failed to load tickets:", err);
      setError(err instanceof Error ? err.message : "Failed to load tickets");
    } finally {
      setLoading(false);
    }
  }, [playerId, page, limit]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  const isClosed = (t: TicketApiData) =>
    String(t.status).toLowerCase() === "closed";
  const isOpen = (t: TicketApiData) =>
    String(t.status).toLowerCase() === "open";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Support Tickets</h3>
          <p className="text-sm text-muted-foreground">
            {total.toLocaleString()} total
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loading size="medium" text="Loading tickets..." />
        </div>
      ) : error ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <p className="text-destructive">{error}</p>
            <Button
              onClick={loadTickets}
              className="mt-4 cursor-pointer"
              variant="outline"
            >
              Try Again
            </Button>
          </div>
        </div>
      ) : tickets.length === 0 ? (
        <div className="py-12 text-center">
          <Ticket className="mx-auto size-12 text-muted-foreground" />
          <p className="mt-2 text-muted-foreground">No tickets found</p>
        </div>
      ) : (
        <>
          {/* Tickets list */}
          <div className="space-y-2">
            {tickets.map((t) => {
              const statusText = String(t.status ?? "unknown");
              const typeText = String(t.type ?? "unknown");

              return (
                <div
                  key={t.id}
                  className="rounded-lg border border-border p-4 transition-colors hover:bg-sidebar-accent/30"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">
                          Ticket #{t.ticketNumber ?? t.id}
                        </p>

                        <Badge
                          variant={isOpen(t) ? "default" : "outline"}
                          className={cn(
                            isOpen(t) &&
                              "bg-green-500/20 text-green-500 hover:bg-green-500/30",
                            isClosed(t) &&
                              "bg-muted text-muted-foreground hover:bg-muted",
                          )}
                        >
                          {statusText}
                        </Badge>

                        <Badge variant="outline">{typeText}</Badge>
                      </div>

                      <p className="mt-1 text-xs text-muted-foreground">
                        Created {new Date(t.createdAt).toLocaleDateString()}
                        {t.channelId ? <> • Channel {t.channelId}</> : null}
                      </p>

                      {/* Optional: show transcript path if present (metadata) */}
                      {t.metadata?.transcriptPath ? (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Transcript: {t.metadata.transcriptPath}
                        </p>
                      ) : null}
                    </div>

                    {/* Placeholder for future actions */}
                    {/* <Button size="sm" variant="outline" className="cursor-pointer">
                      View
                    </Button> */}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination (same as your players list) */}
          <div className="flex items-center justify-between border-t border-border pt-4">
            <p className="text-sm text-muted-foreground">
              Showing {page * limit + 1} to{" "}
              {Math.min((page + 1) * limit, total)} of {total} tickets
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
        </>
      )}
    </div>
  );
}
