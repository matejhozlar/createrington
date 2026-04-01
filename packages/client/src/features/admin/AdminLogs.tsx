import { useCallback, useState } from "react";
import { Loading } from "@/components/loading-spinner";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import {
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Input } from "@/components/ui/input";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Filter,
  FileText,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
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
  return parts.length > 0 ? parts.join(" ") : "—";
}

export function AdminLogs() {
  // Pagination state
  const [page, setPage] = useState(0);
  const [limit] = useState(20);

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [adminFilter, setAdminFilter] = useState<string | undefined>(undefined);

  // Metadata dialog state
  const [metadataAction, setMetadataAction] = useState<
    (typeof actions)[number] | null
  >(null);

  // Sorting state
  const [orderBy, setOrderBy] = useState<SortField>("performedAt");
  const [orderDirection, setOrderDirection] = useState<"asc" | "desc">("desc");

  const debouncedSearch = useDebouncedValue(searchQuery, 1000);

  // tRPC queries
  const adminsQuery = trpc.admin.logs.admins.useQuery();
  const adminList = adminsQuery.data ?? [];

  const logsQuery = trpc.admin.logs.list.useQuery({
    page,
    limit,
    orderBy,
    orderDirection,
    search: debouncedSearch.trim() || undefined,
    adminUsername: adminFilter,
  });

  const actions = logsQuery.data?.actions ?? [];
  const total = logsQuery.data?.pagination.total ?? 0;
  const totalPages = logsQuery.data?.pagination.totalPages ?? 0;
  const loading = logsQuery.isLoading;
  const error = logsQuery.error?.message ?? null;

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
  }, []);

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
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

  const renderSortIcon = useCallback(
    (field: SortField) => {
      if (orderBy !== field) {
        return <ArrowUpDown className="ml-1 size-3.5 opacity-50" />;
      }
      return orderDirection === "asc" ? (
        <ArrowUp className="ml-1 size-3.5" />
      ) : (
        <ArrowDown className="ml-1 size-3.5" />
      );
    },
    [orderBy, orderDirection],
  );

  const getPaginationItems = useCallback(() => {
    const items: (number | "ellipsis")[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      return Array.from({ length: totalPages }, (_, i) => i);
    }

    items.push(0);

    if (page <= 2) {
      items.push(1, 2, 3);
      items.push("ellipsis");
      items.push(totalPages - 1);
    } else if (page >= totalPages - 3) {
      items.push("ellipsis");
      items.push(
        totalPages - 4,
        totalPages - 3,
        totalPages - 2,
        totalPages - 1,
      );
    } else {
      items.push("ellipsis");
      items.push(page - 1, page, page + 1);
      items.push("ellipsis");
      items.push(totalPages - 1);
    }

    return items;
  }, [page, totalPages]);

  return (
    <div className="flex flex-1 flex-col gap-4">
      {/* Header */}
      <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border bg-sidebar px-4">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/admin/dashboard">Admin</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Logs</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      <div className="mx-auto w-full max-w-[1400px] flex flex-1 flex-col gap-4 px-4 pb-4">
        {/* Filters & Search */}
        <Card className="gap-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Filter className="size-4 text-muted-foreground" />
              Filters
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

          {loading ? (
            <CardContent className="flex flex-1 items-center justify-center py-12">
              <Loading size="medium" text="Loading logs..." />
            </CardContent>
          ) : error ? (
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
          ) : actions.length === 0 ? (
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
                <Table>
                  <TableHeader className="bg-sidebar-accent/50">
                    <TableRow>
                      <TableHead className="px-4">
                        <button
                          type="button"
                          onClick={() => handleSort("performedAt")}
                          className="inline-flex items-center gap-1 text-sm font-medium"
                        >
                          Date
                          {renderSortIcon("performedAt")}
                        </button>
                      </TableHead>
                      <TableHead className="px-4">
                        <button
                          type="button"
                          onClick={() => handleSort("adminUsername")}
                          className="inline-flex items-center gap-1 text-sm font-medium"
                        >
                          Admin
                          {renderSortIcon("adminUsername")}
                        </button>
                      </TableHead>
                      <TableHead className="px-4">
                        <button
                          type="button"
                          onClick={() => handleSort("actionType")}
                          className="inline-flex items-center gap-1 text-sm font-medium"
                        >
                          Action
                          {renderSortIcon("actionType")}
                        </button>
                      </TableHead>
                      <TableHead className="px-4">Description</TableHead>
                      <TableHead className="px-4">Changes</TableHead>
                      <TableHead className="px-4">Reason</TableHead>
                      <TableHead className="w-[50px] px-4" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {actions.map((action) => (
                      <TableRow key={action.id}>
                        <TableCell className="px-4 whitespace-nowrap text-sm text-muted-foreground">
                          {new Date(action.performedAt).toLocaleString()}
                        </TableCell>
                        <TableCell className="px-4 text-sm">
                          {action.adminUsername}
                        </TableCell>
                        <TableCell className="px-4">
                          <Badge variant="outline">{action.actionType}</Badge>
                        </TableCell>
                        <TableCell className="px-4 text-sm max-w-[300px] truncate">
                          <span title={getDescription(action)}>
                            {getDescription(action)}
                          </span>
                        </TableCell>
                        <TableCell className="px-4">
                          <div className="flex flex-col gap-1 text-xs max-w-[200px]">
                            {action.oldValue != null && (
                              <code
                                className="bg-destructive/10 text-destructive px-1.5 py-0.5 rounded truncate block"
                                title={action.oldValue}
                              >
                                {action.oldValue}
                              </code>
                            )}
                            {action.newValue != null && (
                              <code
                                className="bg-green-500/10 text-green-600 dark:text-green-400 px-1.5 py-0.5 rounded truncate block"
                                title={action.newValue}
                              >
                                {action.newValue}
                              </code>
                            )}
                            {action.oldValue == null &&
                              action.newValue == null && (
                                <span className="text-muted-foreground">—</span>
                              )}
                          </div>
                        </TableCell>
                        <TableCell
                          className="px-4 text-sm text-muted-foreground max-w-[150px] truncate"
                          title={action.reason ?? undefined}
                        >
                          {action.reason ?? "—"}
                        </TableCell>
                        <TableCell className="px-4">
                          {action.metadata != null && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="size-8 p-0"
                                  onClick={() => setMetadataAction(action)}
                                >
                                  <Info className="size-4 text-muted-foreground" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>View metadata</TooltipContent>
                            </Tooltip>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>

              {/* Pagination */}
              <CardFooter className="flex-col gap-3 border-t sm:flex-row sm:flex-wrap sm:items-center">
                <p className="text-sm text-muted-foreground">
                  Showing {page * limit + 1}-
                  {Math.min((page + 1) * limit, total)} of {total} entries
                </p>

                <PaginationContent className="justify-baseline sm:ml-auto sm:justify-end">
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (page > 0) handlePageChange(page - 1);
                      }}
                      className={cn(
                        page === 0 && "pointer-events-none opacity-50",
                      )}
                    />
                  </PaginationItem>

                  {getPaginationItems().map((item, index) => (
                    <PaginationItem
                      key={item === "ellipsis" ? `ellipsis-${index}` : item}
                    >
                      {item === "ellipsis" ? (
                        <PaginationEllipsis />
                      ) : (
                        <PaginationLink
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            handlePageChange(item);
                          }}
                          isActive={page === item}
                        >
                          {item + 1}
                        </PaginationLink>
                      )}
                    </PaginationItem>
                  ))}

                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (page < totalPages - 1) handlePageChange(page + 1);
                      }}
                      className={cn(
                        page >= totalPages - 1 &&
                          "pointer-events-none opacity-50",
                      )}
                    />
                  </PaginationItem>
                </PaginationContent>
              </CardFooter>
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
                metadataAction ?? {
                  description: null,
                  targetPlayerName: null,
                  tableName: null,
                  fieldName: null,
                },
              )}
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
