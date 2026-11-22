import { useInfiniteQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { AdminPageTitle } from "@/features/admin/components/AdminPageTitle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CellDate, CellText } from "@/components/cell-text";
import {
  BadgeCellSkeleton,
  DataTable,
  TwoLineCellSkeleton,
  type DataTableColumn,
} from "@/components/data-table";
import { History, RefreshCw } from "lucide-react";
import type { ChatHistorySession } from "@createrington/shared/admin-chat";
import { trpc } from "@/lib/trpc";

const PAGE_SIZE = 25;

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

function displayTitle(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("Page:")) return trimmed.slice(5).trim() || "General";
  return trimmed || "General";
}

export function AdminChatHistory() {
  const navigate = useNavigate();
  const historyQuery = useInfiniteQuery(
    trpc.admin.chat.sessions.list.infiniteQueryOptions(
      { limit: PAGE_SIZE },
      { getNextPageParam: (page) => page.nextCursor, staleTime: 0 },
    ),
  );
  const sessions = historyQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const loading = historyQuery.isPending;
  const refreshing =
    historyQuery.isFetching && !historyQuery.isFetchingNextPage;
  const error =
    historyQuery.isError && !historyQuery.isFetchNextPageError
      ? historyQuery.error.message
      : null;
  const loadMoreError = historyQuery.isFetchNextPageError
    ? historyQuery.error.message
    : null;
  const reload = () => void historyQuery.refetch();

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
      render: (s) => <CellDate value={s.createdAt} relative />,
    },
    {
      key: "lastActivity",
      header: "Last activity",
      width: 140,
      cellClassName: "text-sm text-muted-foreground",
      render: (s) => (
        <CellDate
          value={s.lastActivityAt ?? s.completedAt ?? s.createdAt}
          relative
        />
      ),
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
        <AdminPageTitle
          title="Assistant Chat History"
          actions={
            <Button
              variant="outline"
              size="icon"
              onClick={reload}
              disabled={refreshing}
              title="Refresh"
            >
              <RefreshCw
                className={refreshing ? "size-4 animate-spin" : "size-4"}
              />
            </Button>
          }
        />

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

            {historyQuery.hasNextPage && (
              <div className="flex flex-col items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => void historyQuery.fetchNextPage()}
                  loading={historyQuery.isFetchingNextPage}
                >
                  Load more
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
