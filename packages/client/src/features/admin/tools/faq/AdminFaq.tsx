import { useState } from "react";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { AdminPageTitle } from "@/features/admin/components/AdminPageTitle";
import { FilterBar } from "@/features/admin/components/FilterBar";
import { TableCard } from "@/components/paged-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CellDate, CellText } from "@/components/cell-text";
import {
  BadgeCellSkeleton,
  type DataTableAction,
  type DataTableColumn,
} from "@/components/data-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MessageCircleQuestion,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { usePagedQuery } from "@/hooks/use-paged-query";
import { useTableSort } from "@/hooks/use-table-sort";
import { useMutation } from "@tanstack/react-query";
import { EnabledBadge } from "@/features/admin/components/EnabledBadge";
import { FaqEntryDialog } from "./components/modals/FaqEntryDialog";
import { DeleteFaqModal } from "./components/modals/DeleteFaqModal";
import { trpc, type RouterOutput } from "@/lib/trpc";
import { useMutationToast } from "@/hooks/use-mutation-toast";

type FaqEntry = RouterOutput["admin"]["faq"]["list"]["items"][number];

type SortField = "priority" | "title" | "createdAt";
type EnabledFilter = "all" | "enabled" | "disabled";

const ENABLED_FILTER_OPTIONS: { value: EnabledFilter; label: string }[] = [
  { value: "all", label: "All Entries" },
  { value: "enabled", label: "Enabled" },
  { value: "disabled", label: "Disabled" },
];

export function AdminFaq() {
  const [searchQuery, setSearchQuery] = useState("");
  const [enabledFilter, setEnabledFilter] = useState<EnabledFilter>("all");

  const sort = useTableSort<SortField>("priority", {
    newFieldDirection: "desc",
  });

  const [entryDialog, setEntryDialog] = useState<{
    open: boolean;
    entry: FaqEntry | null;
  }>({ open: false, entry: null });
  const openCreate = () => setEntryDialog({ open: true, entry: null });
  const [deleteTarget, setDeleteTarget] = useState<FaqEntry | null>(null);

  const debouncedSearch = useDebouncedValue(searchQuery);

  const repostWelcome = useMutation(
    trpc.admin.faq.repostWelcome.mutationOptions(
      useMutationToast({ success: "Welcome message reposted" }),
    ),
  );

  const entries = usePagedQuery(
    {
      ...sort.order,
      search: debouncedSearch.trim() || undefined,
      enabled:
        enabledFilter === "enabled"
          ? true
          : enabledFilter === "disabled"
            ? false
            : undefined,
    },
    (input) => trpc.admin.faq.list.queryOptions(input),
    10,
  );

  const handleRepostWelcome = () => repostWelcome.mutate();

  const columns: DataTableColumn<FaqEntry>[] = [
    {
      key: "id",
      header: "ID",
      width: 70,
      render: (entry) => <p className="font-mono text-sm">#{entry.id}</p>,
    },
    {
      key: "title",
      header: "Title",
      minWidth: 200,
      ...sort.column("title"),
      render: (entry) => (
        <CellText value={entry.title} className="font-medium" />
      ),
    },
    {
      key: "mode",
      header: "Mode",
      width: 110,
      skeleton: () => <BadgeCellSkeleton />,
      render: (entry) => (
        <Badge variant="outline" className="text-xs">
          {entry.matchMode === "regex" ? "Regex" : "Keywords"}
        </Badge>
      ),
    },
    {
      key: "pattern",
      header: "Pattern",
      minWidth: 160,
      render: (entry) => (
        <CellText
          value={entry.pattern}
          className={cn(
            "text-xs text-muted-foreground",
            entry.matchMode === "regex" && "font-mono",
          )}
        />
      ),
    },
    {
      key: "priority",
      header: "Priority",
      width: 105,
      ...sort.column("priority"),
      cellClassName: "text-sm",
      render: (entry) => entry.priority,
    },
    {
      key: "status",
      header: "Status",
      width: 110,
      skeleton: () => <BadgeCellSkeleton />,
      render: (entry) => <EnabledBadge enabled={entry.enabled} />,
    },
    {
      key: "created",
      header: "Created",
      width: 130,
      ...sort.column("createdAt"),
      render: (entry) => <CellDate value={entry.createdAt} />,
    },
  ];

  const entryActions = (entry: FaqEntry): DataTableAction[] => [
    {
      label: "Edit",
      icon: Pencil,
      onClick: () => setEntryDialog({ open: true, entry }),
    },
    {
      label: "Delete",
      icon: Trash2,
      variant: "destructive",
      onClick: () => setDeleteTarget(entry),
    },
  ];

  return (
    <div className="flex flex-1 flex-col gap-4">
      <AdminPageHeader
        trail={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Tools", href: "/admin/tools" },
          { label: "FAQ" },
        ]}
      />

      <div className="mx-auto w-full max-w-[1400px] flex flex-1 flex-col gap-4 px-4 pb-4">
        <AdminPageTitle
          title="FAQ Auto-Responder"
          actions={
            <>
              <Button
                variant="outline"
                onClick={handleRepostWelcome}
                disabled={repostWelcome.isPending}
              >
                <RefreshCw
                  className={cn(
                    "mr-2 size-4",
                    repostWelcome.isPending && "animate-spin",
                  )}
                />
                Repost Welcome
              </Button>
              <Button onClick={openCreate}>
                <Plus className="mr-2 size-4" />
                New Entry
              </Button>
            </>
          }
        />

        <FilterBar
          search={searchQuery}
          onSearchChange={setSearchQuery}
          placeholder="Search by title..."
          activeCount={
            (searchQuery ? 1 : 0) + (enabledFilter !== "all" ? 1 : 0)
          }
        >
          <Select
            value={enabledFilter}
            onValueChange={(v) => setEnabledFilter(v as EnabledFilter)}
          >
            <SelectTrigger className="min-w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ENABLED_FILTER_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterBar>

        <TableCard
          title="FAQ Entries"
          paged={entries}
          empty={{
            icon: MessageCircleQuestion,
            message: "No FAQ entries found",
            children: (
              <Button onClick={openCreate}>
                <Plus className="mr-2 size-4" />
                Create First Entry
              </Button>
            ),
          }}
          itemLabel="entry"
          columns={columns}
          rowKey={(entry) => entry.id}
          actions={entryActions}
        />
      </div>

      <FaqEntryDialog
        key={entryDialog.entry?.id ?? "new"}
        open={entryDialog.open}
        onClose={() => setEntryDialog({ open: false, entry: null })}
        entry={entryDialog.entry}
      />

      <DeleteFaqModal
        entry={deleteTarget}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
