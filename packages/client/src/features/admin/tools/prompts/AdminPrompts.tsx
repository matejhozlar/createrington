import { useState } from "react";
import { useNavigate } from "react-router";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { AdminPageTitle } from "@/features/admin/components/AdminPageTitle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CellText } from "@/components/cell-text";
import {
  BadgeCellSkeleton,
  TwoLineCellSkeleton,
  type DataTableAction,
  type DataTableColumn,
} from "@/components/data-table";
import { TableCard } from "@/components/paged-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MessageSquare, Plus, RefreshCw, Trash2 } from "lucide-react";
import { formatFullDate } from "@/features/admin/format";
import { usePagedQuery } from "@/hooks/use-paged-query";
import { trpc, type RouterOutput } from "@/lib/trpc";
import { CreatePromptModal } from "./components/CreatePromptModal";
import { DeletePromptModal } from "./components/DeletePromptModal";

type StatusFilter = "all" | "active" | "closed";
type PromptRow = RouterOutput["admin"]["prompts"]["list"]["items"][number];

function formatEndsAt(date: Date | string): string {
  const d = new Date(date);
  const diffMs = d.getTime() - Date.now();
  if (diffMs <= 0) return "Ended";
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 60) return `in ${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `in ${hours}h`;
  const days = Math.round(hours / 24);
  return `in ${days}d`;
}

export function AdminPrompts() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PromptRow | null>(null);

  const prompts = usePagedQuery(
    { status: statusFilter === "all" ? undefined : statusFilter },
    (input) => trpc.admin.prompts.list.queryOptions(input),
  );

  const columns: DataTableColumn<PromptRow>[] = [
    {
      key: "question",
      header: "Question",
      minWidth: 240,
      skeleton: () => <TwoLineCellSkeleton />,
      render: (row) => (
        <>
          <CellText value={row.question} className="font-medium" />
          {row.description && (
            <CellText
              value={row.description}
              className="mt-0.5 text-xs text-muted-foreground"
            />
          )}
        </>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: 100,
      skeleton: () => <BadgeCellSkeleton />,
      render: (row) => (
        <Badge variant={row.status === "active" ? "default" : "secondary"}>
          {row.status === "active" ? "Active" : "Closed"}
        </Badge>
      ),
    },
    {
      key: "mode",
      header: "Mode",
      width: 100,
      skeleton: () => <BadgeCellSkeleton />,
      render: (row) => (
        <Badge variant="outline">
          {row.entryMode === "multi" ? "Multi" : "Single"}
        </Badge>
      ),
    },
    {
      key: "responses",
      header: "Entries",
      width: 120,
      align: "right",
      cellClassName: "tabular-nums",
      skeleton: () => (
        <div className="flex flex-col items-end">
          <div className="flex h-5 items-center">
            <Skeleton className="h-4 w-8" />
          </div>
          <div className="flex h-4 items-center">
            <Skeleton className="h-3 w-14" />
          </div>
        </div>
      ),
      render: (row) => (
        <>
          <div>{row.responseCount}</div>
          {row.entryMode === "multi" && row.responseCount > 0 && (
            <div className="text-xs text-muted-foreground">
              from {row.responderCount}
            </div>
          )}
        </>
      ),
    },
    {
      key: "ends",
      header: "Ends",
      width: 100,
      cellClassName: "text-sm text-muted-foreground",
      render: (row) =>
        row.status === "closed" ? null : (
          <CellText
            value={formatFullDate(new Date(row.endsAt).toISOString())}
            display={formatEndsAt(row.endsAt)}
          />
        ),
    },
  ];

  const promptActions = (row: PromptRow): DataTableAction[] => [
    {
      label: "Delete",
      icon: Trash2,
      variant: "destructive",
      onClick: () => setDeleteTarget(row),
    },
  ];

  return (
    <div className="flex flex-1 flex-col gap-4">
      <AdminPageHeader
        trail={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Tools", href: "/admin/tools" },
          { label: "Player Prompts" },
        ]}
      />

      <div className="mx-auto w-full max-w-[1400px] flex flex-1 flex-col gap-4 px-4 pb-4">
        <AdminPageTitle
          title="Player Prompts"
          actions={
            <>
              <Select
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as StatusFilter)}
              >
                <SelectTrigger className="w-full xs:w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="icon"
                onClick={prompts.retry}
                disabled={prompts.query.isFetching}
                title="Refresh"
              >
                <RefreshCw
                  className={
                    prompts.query.isFetching ? "size-4 animate-spin" : "size-4"
                  }
                />
              </Button>
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="size-4" /> New Prompt
              </Button>
            </>
          }
        />

        <TableCard
          paged={prompts}
          empty={{
            icon: MessageSquare,
            message: "No prompts yet.",
            hint: "Create one to ask players a question in Discord.",
            className: "py-16",
          }}
          itemLabel="prompt"
          columns={columns}
          rowKey={(row) => row.id}
          onRowClick={(row) => navigate(`/admin/tools/prompts/${row.id}`)}
          actions={promptActions}
          actionSlots={1}
        />
      </div>

      <CreatePromptModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />

      <DeletePromptModal
        prompt={deleteTarget}
        entryCount={deleteTarget?.responseCount ?? 0}
        onClose={() => setDeleteTarget(null)}
        onSuccess={() => {
          setDeleteTarget(null);
          if (prompts.rows.length === 1 && prompts.page > 0) {
            prompts.setPage(prompts.page - 1);
          }
        }}
      />
    </div>
  );
}
