import { useCallback, useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { Loading } from "@/components/loading-spinner";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { History, RefreshCw } from "lucide-react";
import {
  fetchChatSessions,
  type ChatHistorySession,
} from "@/features/admin-chat/api";
import { formatFullDate, formatRelativeDate } from "@/features/admin/format";

const STATUS_VARIANT: Record<
  string,
  { variant: "default" | "secondary" | "destructive"; label: string }
> = {
  completed: { variant: "secondary", label: "Completed" },
  failed: { variant: "destructive", label: "Failed" },
};

function statusBadge(status: string): React.JSX.Element {
  const meta = STATUS_VARIANT[status] ?? {
    variant: "secondary" as const,
    label: status,
  };
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}

// Upstream stores titles as "Page: <location>". Strip the prefix.
function displayTitle(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("Page:")) return trimmed.slice(5).trim() || "General";
  return trimmed || "General";
}

export function AdminChatHistory() {
  const [sessions, setSessions] = useState<ChatHistorySession[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);

  const loadFirstPage = useCallback(async () => {
    setLoading(true);
    setError(null);
    setLoadMoreError(null);
    try {
      const page = await fetchChatSessions({ limit: 25 });
      setSessions(page.sessions);
      setNextCursor(page.nextCursor);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Failed to load sessions",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setLoadMoreError(null);
    try {
      const page = await fetchChatSessions({ limit: 25, cursor: nextCursor });
      setSessions((prev) => [...prev, ...page.sessions]);
      setNextCursor(page.nextCursor);
    } catch (error) {
      // Inline error: don't clobber the whole list on a pagination failure.
      setLoadMoreError(
        error instanceof Error ? error.message : "Failed to load more",
      );
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, loadingMore]);

  useEffect(() => {
    void loadFirstPage();
  }, [loadFirstPage]);

  return (
    <div className="flex flex-1 flex-col gap-4">
      <AdminPageHeader
        trail={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Tools", href: "/admin/tools" },
          { label: "Chat History" },
        ]}
      />

      <div className="mx-auto w-full max-w-[1400px] flex flex-1 flex-col gap-4 px-4 pb-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">Assistant Chat History</h1>
          <Button
            variant="outline"
            size="icon"
            onClick={() => void loadFirstPage()}
            disabled={loading}
            title="Refresh"
          >
            <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} />
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loading mode="inline" size="medium" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-border bg-card py-16 text-center">
            <p className="text-destructive">{error}</p>
            <Button
              variant="outline"
              onClick={() => void loadFirstPage()}
              className="mt-2"
            >
              Try Again
            </Button>
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-border bg-card py-16 text-center">
            <History className="size-10 text-muted-foreground" />
            <p className="text-muted-foreground">No past sessions yet.</p>
            <p className="text-sm text-muted-foreground/80">
              End a chat in the assistant drawer and it'll show up here.
            </p>
          </div>
        ) : (
          <>
            <div className="rounded-lg border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead className="w-28">Status</TableHead>
                    <TableHead className="w-24 text-right">Messages</TableHead>
                    <TableHead className="w-40">Started</TableHead>
                    <TableHead className="w-40">Last activity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map((s) => {
                    const last =
                      s.lastActivityAt ?? s.completedAt ?? s.createdAt;
                    return (
                      <TableRow key={s.id}>
                        <TableCell>
                          <NavLink
                            to={`/admin/tools/chat-history/${s.id}`}
                            className="font-medium hover:text-primary"
                          >
                            {displayTitle(s.title)}
                          </NavLink>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Session #{s.id}
                          </p>
                        </TableCell>
                        <TableCell>{statusBadge(s.status)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {s.messageCount}
                        </TableCell>
                        <TableCell>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-sm text-muted-foreground cursor-default">
                                {formatRelativeDate(s.createdAt)}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" align="start">
                              {formatFullDate(s.createdAt)}
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-sm text-muted-foreground cursor-default">
                                {formatRelativeDate(last)}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" align="start">
                              {formatFullDate(last)}
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {nextCursor !== null && (
              <div className="flex flex-col items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => void loadMore()}
                  disabled={loadingMore}
                >
                  {loadingMore ? "Loading…" : "Load more"}
                </Button>
                {loadMoreError && (
                  <p className="text-sm text-destructive">{loadMoreError}</p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
