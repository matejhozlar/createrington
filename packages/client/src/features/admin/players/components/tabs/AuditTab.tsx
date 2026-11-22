import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { Paginator } from "@/components/paginator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { usePagedQuery } from "@/hooks/use-paged-query";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/query-states";

interface AuditTabProps {
  playerId: string;
}

export function AuditTab({ playerId }: AuditTabProps) {
  const audit = usePagedQuery(
    { id: playerId },
    (input) => trpc.admin.players.audit.list.queryOptions(input),
    10,
  );
  const actions = audit.rows;

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
            {audit.total.toLocaleString()} total actions
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={audit.retry}
          loading={audit.loading}
        >
          <FileText className="size-4" />
          Refresh
        </Button>
      </div>

      {audit.query.isLoading ? (
        <LoadingState text="Loading audit log..." />
      ) : audit.error ? (
        <ErrorState message={audit.error} onRetry={audit.retry} />
      ) : actions.length === 0 ? (
        <EmptyState icon={FileText} message="No audit log entries found" />
      ) : (
        <>
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
                          <Collapsible>
                            <CollapsibleTrigger className="mt-2 cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
                              View Metadata
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <pre className="mt-1 rounded bg-muted p-2 text-xs">
                                {JSON.stringify(action.metadata, null, 2)}
                              </pre>
                            </CollapsibleContent>
                          </Collapsible>
                        )}
                    </div>

                    <p className="mt-2 text-xs text-muted-foreground">
                      Performed by {action.adminUsername} on{" "}
                      {new Date(action.performedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Paginator
            page={audit.page}
            limit={audit.limit}
            total={audit.total}
            totalPages={audit.totalPages}
            onPageChange={audit.setPage}
            itemLabel="action"
            className="border-t border-border pt-4"
          />
        </>
      )}
    </div>
  );
}
