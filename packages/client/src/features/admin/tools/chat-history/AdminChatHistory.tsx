import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CellText } from "@/components/cell-text";
import {
  BadgeCellSkeleton,
  DataTable,
  TwoLineCellSkeleton,
  type DataTableColumn,
} from "@/components/data-table";
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
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<ChatHistorySession[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);

  const loadFirstPage = useCallback(() => {
    return fetchChatSessions({ limit: 25 })
      .then((page) => {
        setSessions(page.sessions);
        setNextCursor(page.nextCursor);
        setError(null);
        setLoadMoreError(null);
      })
      .catch((error: unknown) => {
        setError(
          error instanceof Error ? error.message : "Failed to load sessions",
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    setLoadMoreError(null);
    void loadFirstPage();
  }, [loadFirstPage]);

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

  const columns: DataTableColumn<ChatHistorySession>[] = [
    {
      key: "title",
      header: "Title",
      minWidth: 240,
      skeleton: () => <TwoLineCellSkeleton />,
      render: (s) => (
        <>
          <CellText value={displayTitle(s.title)} className="font-medium" />
          <p className="mt-0.5 text-xs text-muted-foreground">
            Session #{s.id}
          </p>
        </>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: 120,
      skeleton: () => <BadgeCellSkeleton />,
      render: (s) => statusBadge(s.status),
    },
    {
      key: "messages",
      header: "Messages",
      width: 110,
      align: "right",
      cellClassName: "tabular-nums",
      render: (s) => s.messageCount,
    },
    {
      key: "started",
      header: "Started",
      width: 140,
      cellClassName: "text-sm text-muted-foreground",
      render: (s) => (
        <CellText
          value={formatFullDate(s.createdAt)}
          display={formatRelativeDate(s.createdAt)}
        />
      ),
    },
    {
      key: "lastActivity",
      header: "Last activity",
      width: 140,
      cellClassName: "text-sm text-muted-foreground",
      render: (s) => {
        const last = s.lastActivityAt ?? s.completedAt ?? s.createdAt;
        return (
          <CellText
            value={formatFullDate(last)}
            display={formatRelativeDate(last)}
          />
        );
      },
    },
  ];

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
            onClick={reload}
            disabled={loading}
            title="Refresh"
          >
            <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} />
          </Button>
        </div>

        {error ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-border bg-card py-16 text-center">
            <p className="text-destructive">{error}</p>
            <Button variant="outline" onClick={reload} className="mt-2">
              Try Again
            </Button>
          </div>
        ) : !loading && sessions.length === 0 ? (
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
              <DataTable
                columns={columns}
                rows={sessions}
                loading={loading}
                rowKey={(s) => s.id}
                onRowClick={(s) =>
                  navigate(`/admin/tools/chat-history/${s.id}`)
                }
              />
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
