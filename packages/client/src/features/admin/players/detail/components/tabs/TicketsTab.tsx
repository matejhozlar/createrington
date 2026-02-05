import { useCallback, useEffect, useState } from "react";
import { Loading } from "@/components/loading-spinner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Ticket } from "lucide-react";
import {
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { cn } from "@/lib/utils";
import type { TicketApiData } from "@createrington/shared/db";
import { adminPlayerApi } from "@/services/api/admin/admin-players";

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

  const loadTickets = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await adminPlayerApi.getTickets(playerId, {
        page,
        limit,
      });

      setTickets(data.tickets);
      setTotal(data.pagination.total);
      setTotalPages(data.pagination.totalPages);
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center gap-4 border-t border-border pt-4">
              <p className="flex-1 text-sm text-muted-foreground">
                Showing {page * limit + 1}-{Math.min((page + 1) * limit, total)}{" "}
                of {total} tickets
              </p>

              {/* Right-aligned: no <Pagination /> wrapper */}
              <PaginationContent className="ml-auto flex-nowrap justify-end">
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (page > 0) handlePageChange(page - 1);
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
                          handlePageChange(item);
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
                      if (page < totalPages - 1) handlePageChange(page + 1);
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
    </div>
  );
}
