import { useState } from "react";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { FilterBar } from "@/features/admin/components/FilterBar";
import { TableCard } from "@/components/paged-table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CellDate, CellText } from "@/components/cell-text";
import {
  BadgeCellSkeleton,
  type DataTableColumn,
} from "@/components/data-table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileText, Info } from "lucide-react";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { usePagedQuery } from "@/hooks/use-paged-query";
import { useTableSort } from "@/hooks/use-table-sort";
import { useQuery } from "@tanstack/react-query";
import { trpc, type RouterOutput } from "@/lib/trpc";

type SortField = "performedAt" | "actionType" | "adminUsername";

type LogAction = RouterOutput["admin"]["logs"]["list"]["items"][number];

function getDescription(action: {
  description: string | null;
  targetPlayerName: string | null;
  tableName: string | null;
  fieldName: string | null;
}): string {
  if (action.description) return action.description;
  const parts: string[] = [];
  if (action.tableName && action.fieldName) {
    parts.push(`${action.tableName}.${action.fieldName}`);
  } else if (action.tableName) {
    parts.push(action.tableName);
  }
  if (action.targetPlayerName) {
    parts.push(`for ${action.targetPlayerName}`);
  }
  return parts.join(" ");
}

export function AdminLogs() {
  const [searchQuery, setSearchQuery] = useState("");
  const [adminFilter, setAdminFilter] = useState<string | undefined>(undefined);

  const [metadataAction, setMetadataAction] = useState<LogAction | null>(null);

  const sort = useTableSort<SortField>("performedAt");
  const debouncedSearch = useDebouncedValue(searchQuery);

  const adminsQuery = useQuery(trpc.admin.logs.admins.queryOptions());
  const adminList = adminsQuery.data ?? [];

  const logs = usePagedQuery(
    {
      ...sort.order,
      search: debouncedSearch.trim() || undefined,
      adminUsername: adminFilter,
    },
    (input) => trpc.admin.logs.list.queryOptions(input),
  );

  const columns: DataTableColumn<LogAction>[] = [
    {
      key: "date",
      header: "Date",
      width: 115,
      ...sort.column("performedAt"),
      render: (action) => <CellDate value={action.performedAt} />,
    },
    {
      key: "admin",
      header: "Admin",
      minWidth: 130,
      ...sort.column("adminUsername"),
      render: (action) => (
        <CellText value={action.adminUsername} className="text-sm" />
      ),
    },
    {
      key: "action",
      header: "Action",
      width: 200,
      ...sort.column("actionType"),
      skeleton: () => <BadgeCellSkeleton />,
      render: (action) => (
        <Badge variant="outline" className="max-w-full">
          <CellText value={action.actionType} className="min-w-0" />
        </Badge>
      ),
    },
    {
      key: "description",
      header: "Description",
      minWidth: 200,
      render: (action) => {
        const description = getDescription(action);
        return (
          description && <CellText value={description} className="text-sm" />
        );
      },
    },
    {
      key: "changes",
      header: "Changes",
      width: 220,
      skeleton: () => (
        <div className="flex flex-col gap-1">
          <Skeleton className="h-5 w-32 rounded" />
          <Skeleton className="h-5 w-32 rounded" />
        </div>
      ),
      render: (action) =>
        (action.oldValue != null || action.newValue != null) && (
          <div className="flex flex-col gap-1 text-xs">
            {action.oldValue != null && (
              <code className="block rounded bg-destructive/10 px-1.5 py-0.5 text-destructive">
                <CellText value={action.oldValue} />
              </code>
            )}
            {action.newValue != null && (
              <code className="block rounded bg-green-500/10 px-1.5 py-0.5 text-green-600 dark:text-green-400">
                <CellText value={action.newValue} />
              </code>
            )}
          </div>
        ),
    },
    {
      key: "reason",
      header: "Reason",
      minWidth: 150,
      cellClassName: "text-sm text-muted-foreground",
      render: (action) => action.reason && <CellText value={action.reason} />,
    },
  ];

  return (
    <div className="flex flex-1 flex-col gap-4">
      <AdminPageHeader
        trail={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Logs" },
        ]}
      />

      <div className="mx-auto w-full max-w-[1400px] flex flex-1 flex-col gap-4 px-4 pb-4">
        <FilterBar
          search={searchQuery}
          onSearchChange={setSearchQuery}
          placeholder="Search logs..."
          activeCount={
            (searchQuery ? 1 : 0) + (adminFilter !== undefined ? 1 : 0)
          }
        >
          <Select
            value={adminFilter ?? "all"}
            onValueChange={(v) => setAdminFilter(v === "all" ? undefined : v)}
          >
            <SelectTrigger className="min-w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Admins</SelectItem>
              {adminList.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterBar>

        <TableCard
          title="Audit Logs"
          paged={logs}
          empty={{ icon: FileText, message: "No log entries found" }}
          itemLabel="entry"
          columns={columns}
          rowKey={(action) => action.id}
          actions={(action) =>
            action.metadata != null
              ? [
                  {
                    label: "View metadata",
                    icon: Info,
                    onClick: () => setMetadataAction(action),
                  },
                ]
              : []
          }
          actionSlots={1}
        />
      </div>

      <Dialog
        open={metadataAction !== null}
        onOpenChange={(open) => {
          if (!open) setMetadataAction(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Entry Metadata</DialogTitle>
            <DialogDescription>
              {getDescription(
                metadataAction ?? {
                  description: null,
                  targetPlayerName: null,
                  tableName: null,
                  fieldName: null,
                },
              ) || "—"}
            </DialogDescription>
          </DialogHeader>
          <pre className="max-h-[400px] overflow-auto rounded-md bg-muted p-4 text-xs">
            {JSON.stringify(metadataAction?.metadata, null, 2)}
          </pre>
          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>
    </div>
  );
}
