import { useState } from "react";
import { Paginator } from "@/components/paginator";
import { Badge } from "@/components/ui/badge";
import { Ticket } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useQuery } from "@tanstack/react-query";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/query-states";

interface TicketsTabProps {
  playerId: string; // minecraftUuid (route param)
}

export function TicketsTab({ playerId }: TicketsTabProps) {
  const [page, setPage] = useState(0);
  const [limit] = useState(10);

  const ticketsQuery = useQuery(
    trpc.admin.players.tickets.list.queryOptions({
      id: playerId,
      page,
      limit,
    }),
  );

  const tickets = ticketsQuery.data?.tickets ?? [];
  const total = ticketsQuery.data?.pagination.total ?? 0;
  const totalPages = ticketsQuery.data?.pagination.totalPages ?? 0;
  const loading = ticketsQuery.isLoading;
  const error = ticketsQuery.error?.message ?? null;

  const isClosed = (t: (typeof tickets)[number]) =>
    String(t.status).toLowerCase() === "closed";
  const isOpen = (t: (typeof tickets)[number]) =>
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
        <LoadingState text="Loading tickets..." />
      ) : error ? (
        <ErrorState message={error} onRetry={() => ticketsQuery.refetch()} />
      ) : tickets.length === 0 ? (
        <EmptyState icon={Ticket} message="No tickets found" />
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
                          variant="outline"
                          tone={
                            isOpen(t)
                              ? "success"
                              : isClosed(t)
                                ? "neutral"
                                : undefined
                          }
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

          <Paginator
            page={page}
            limit={limit}
            total={total}
            totalPages={totalPages}
            onPageChange={setPage}
            itemLabel="ticket"
            className="border-t border-border pt-4"
          />
        </>
      )}
    </div>
  );
}
