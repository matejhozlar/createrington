import { Paginator } from "@/components/paginator";
import { Badge } from "@/components/ui/badge";
import { Ticket } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { usePagedQuery } from "@/hooks/use-paged-query";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/query-states";

interface TicketsTabProps {
  playerId: string;
}

export function TicketsTab({ playerId }: TicketsTabProps) {
  const paged = usePagedQuery(
    { id: playerId },
    (input) => trpc.admin.players.tickets.list.queryOptions(input),
    10,
  );
  const tickets = paged.rows;

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
            {paged.total.toLocaleString()} total
          </p>
        </div>
      </div>

      {paged.query.isLoading ? (
        <LoadingState text="Loading tickets..." />
      ) : paged.error ? (
        <ErrorState message={paged.error} onRetry={paged.retry} />
      ) : tickets.length === 0 ? (
        <EmptyState icon={Ticket} message="No tickets found" />
      ) : (
        <>
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

                      {t.metadata?.transcriptPath ? (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Transcript: {t.metadata.transcriptPath}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <Paginator
            page={paged.page}
            limit={paged.limit}
            total={paged.total}
            totalPages={paged.totalPages}
            onPageChange={paged.setPage}
            itemLabel="ticket"
            className="border-t border-border pt-4"
          />
        </>
      )}
    </div>
  );
}
