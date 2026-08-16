import { useCallback, useState } from "react";
import { useStickyValue } from "@/hooks/use-sticky-value";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Paginator } from "@/components/paginator";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CellDate, CellText } from "@/components/cell-text";
import {
  BadgeCellSkeleton,
  DataTable,
  loadingRowCount,
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
import { Search, Filter, FileText, Info } from "lucide-react";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { keepPreviousData } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc";

type SortField = "performedAt" | "actionType" | "adminUsername";

/** Build a human-readable description for an audit log entry */
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
  const [page, setPage] = useState(0);
  const [limit] = useState(20);

  const [searchQuery, setSearchQuery] = useState("");
  const [adminFilter, setAdminFilter] = useState<string | undefined>(undefined);

  const [metadataAction, setMetadataAction] = useState<
    (typeof actions)[number] | null
  >(null);
  const displayMetadataAction = useStickyValue(metadataAction);

  const [orderBy, setOrderBy] = useState<SortField>("performedAt");
  const [orderDirection, setOrderDirection] = useState<"asc" | "desc">("desc");

  const debouncedSearch = useDebouncedValue(searchQuery, 1000);

  const adminsQuery = trpc.admin.logs.admins.useQuery();
  const adminList = adminsQuery.data ?? [];

  const logsQuery = trpc.admin.logs.list.useQuery(
    {
      page,
      limit,
      orderBy,
      orderDirection,
      search: debouncedSearch.trim() || undefined,
      adminUsername: adminFilter,
    },
    { placeholderData: keepPreviousData },
  );

  const actions = logsQuery.data?.actions ?? [];
  const total = logsQuery.data?.pagination.total ?? 0;
  const totalPages = logsQuery.data?.pagination.totalPages ?? 0;
  const loading = logsQuery.isLoading || logsQuery.isPlaceholderData;
  const loadingRows = loadingRowCount(page, limit, total);
  const error = logsQuery.error?.message ?? null;

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    setPage(0);
  }, []);

  const handleSort = useCallback(
    (field: SortField) => {
      if (orderBy === field) {
        setOrderDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      } else {
        setOrderBy(field);
        setOrderDirection("asc");
      }
      setPage(0);
    },
    [orderBy],
  );

  type LogAction = (typeof actions)[number];

  const columns: DataTableColumn<LogAction>[] = [
    {
      key: "date",
      header: "Date",
      width: 115,
      sorted: orderBy === "performedAt" ? orderDirection : false,
      onSort: () => handleSort("performedAt"),
      render: (action) => <CellDate value={action.performedAt} />,
    },
    {
      key: "admin",
      header: "Admin",
      minWidth: 130,
      sorted: orderBy === "adminUsername" ? orderDirection : false,
      onSort: () => handleSort("adminUsername"),
      render: (action) => (
        <CellText value={action.adminUsername} className="text-sm" />
      ),
    },
    {
      key: "action",
      header: "Action",
      width: 200,
      sorted: orderBy === "actionType" ? orderDirection : false,
      onSort: () => handleSort("actionType"),
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
      {/* Header */}
      <AdminPageHeader
        trail={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Logs" },
        ]}
      />

      <div className="mx-auto w-full max-w-[1400px] flex flex-1 flex-col gap-4 px-4 pb-4">
        {/* Filters & Search */}
        <Card className="gap-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Filter className="size-4 text-muted-foreground" />
              Filters
              {(searchQuery || adminFilter !== undefined) && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {(searchQuery ? 1 : 0) + (adminFilter !== undefined ? 1 : 0)}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearch} className="flex flex-wrap gap-2">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search logs..."
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-9"
                />
              </div>

              <Select
                value={adminFilter ?? "all"}
                onValueChange={(v) => {
                  setAdminFilter(v === "all" ? undefined : v);
                  setPage(0);
                }}
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

              <Button type="submit" className="min-w-[85px]">
                Search
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Logs Table */}
        <Card className="gap-0">
          <CardHeader className="border-b gap-0">
            <CardTitle>Audit Logs ({total.toLocaleString()})</CardTitle>
          </CardHeader>

          {error ? (
            <CardContent className="flex flex-1 items-center justify-center py-12">
              <div className="text-center">
                <p className="text-destructive">{error}</p>
                <Button
                  onClick={() => logsQuery.refetch()}
                  className="mt-4"
                  variant="outline"
                >
                  Try Again
                </Button>
              </div>
            </CardContent>
          ) : !loading && actions.length === 0 ? (
            <CardContent className="flex flex-1 items-center justify-center py-12">
              <div className="text-center">
                <FileText className="mx-auto size-12 text-muted-foreground" />
                <p className="mt-2 text-muted-foreground">
                  No log entries found
                </p>
              </div>
            </CardContent>
          ) : (
            <>
              <CardContent className="px-0">
                <DataTable
                  columns={columns}
                  rows={actions}
                  loading={loading}
                  loadingRows={loadingRows}
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
              </CardContent>

              {total > 0 && (
                <CardFooter className="border-t">
                  <Paginator
                    page={page}
                    limit={limit}
                    total={total}
                    totalPages={totalPages}
                    onPageChange={setPage}
                    itemLabel="entry"
                    className="w-full"
                  />
                </CardFooter>
              )}
            </>
          )}
        </Card>
      </div>

      {/* Metadata Dialog */}
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
                displayMetadataAction ?? {
                  description: null,
                  targetPlayerName: null,
                  tableName: null,
                  fieldName: null,
                },
              ) || "—"}
            </DialogDescription>
          </DialogHeader>
          <pre className="max-h-[400px] overflow-auto rounded-md bg-muted p-4 text-xs">
            {JSON.stringify(displayMetadataAction?.metadata, null, 2)}
          </pre>
          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>
    </div>
  );
}
