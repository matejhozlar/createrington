import { useCallback, useMemo, useState } from "react";
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
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Clock,
  Filter,
  RefreshCw,
  Search,
  Trash2,
  UserCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { trpc, type RouterOutput } from "@/lib/trpc";
import { useToastActions } from "@/hooks/use-toast";
import { formatFullDate, formatRelativeDate } from "@/features/admin/format";
import {
  STAT_CARDS,
  STATUS_BADGE_CLASSES,
  STATUS_FILTER_OPTIONS,
  STATUS_LABELS,
  daysUntilDeadline,
  deriveWarningStatus,
  type WarningStatusFilter,
} from "./constants";
import { ResolveWarningModal } from "./components/modals/ResolveWarningModal";
import { RemoveWarningModal } from "./components/modals/RemoveWarningModal";

type Warning = RouterOutput["admin"]["inactivity"]["list"]["warnings"][number];

/** Normalizes a tRPC-serialized timestamp to an ISO string. */
function toIso(value: string | Date): string {
  return typeof value === "string" ? value : new Date(value).toISOString();
}

export function InactivityManagement() {
  const toast = useToastActions();

  // Pagination state
  const [page, setPage] = useState(0);
  const [limit] = useState(20);

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<WarningStatusFilter>("all");

  // Modal state
  const [resolveModal, setResolveModal] = useState<{
    open: boolean;
    warning: Warning | null;
  }>({ open: false, warning: null });
  const [removeModal, setRemoveModal] = useState<{
    open: boolean;
    warning: Warning | null;
  }>({ open: false, warning: null });

  const debouncedSearch = useDebouncedValue(searchQuery, 500);

  const capabilitiesQuery = trpc.admin.inactivity.capabilities.useQuery();
  const statsQuery = trpc.admin.inactivity.stats.useQuery();
  const listQuery = trpc.admin.inactivity.list.useQuery({
    status: statusFilter,
    search: debouncedSearch.trim() || undefined,
    page,
    limit,
  });

  const triggerCleanup = trpc.admin.inactivity.triggerCleanup.useMutation();

  // Destructure refetch so the callbacks below have stable deps — the
  // full query object is a new reference on every render.
  const { refetch: refetchList } = listQuery;
  const { refetch: refetchStats } = statsQuery;

  const warnings = listQuery.data?.warnings ?? [];
  const total = listQuery.data?.pagination.total ?? 0;
  const totalPages = listQuery.data?.pagination.totalPages ?? 0;
  const loading = listQuery.isLoading;
  const error = listQuery.error?.message ?? null;

  const canMutate = capabilitiesQuery.data?.canMutate ?? false;
  const graceDays = capabilitiesQuery.data?.graceDays ?? 14;

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchQuery(e.target.value);
      // Reset pagination on every keystroke so the debounced query
      // below can't land on an out-of-range page when results shrink.
      setPage(0);
    },
    [],
  );

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
  }, []);

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  const handleSuccess = useCallback(() => {
    setResolveModal({ open: false, warning: null });
    setRemoveModal({ open: false, warning: null });
    refetchList();
    refetchStats();
  }, [refetchList, refetchStats]);

  const handleTriggerCleanup = useCallback(async () => {
    try {
      await triggerCleanup.mutateAsync();
      toast.success("Cleanup cycle completed");
      refetchList();
      refetchStats();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to run cleanup cycle",
      );
    }
  }, [triggerCleanup, toast, refetchList, refetchStats]);

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

  const stats = useMemo(
    () => ({
      active: statsQuery.data?.active ?? 0,
      expired: statsQuery.data?.expired ?? 0,
      resolvedLast30d: statsQuery.data?.resolvedLast30d ?? 0,
      removedLast30d: statsQuery.data?.removedLast30d ?? 0,
    }),
    [statsQuery.data],
  );

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
              <BreadcrumbLink href="/admin/tools">Tools</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Inactivity Management</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      <div className="mx-auto w-full max-w-[1400px] flex flex-1 flex-col gap-4 px-4 pb-4">
        {/* Title + Actions */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Inactivity Management</h1>
          <div className="flex gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    variant="outline"
                    onClick={handleTriggerCleanup}
                    disabled={!canMutate || triggerCleanup.isPending}
                  >
                    <RefreshCw
                      className={cn(
                        "mr-2 size-4",
                        triggerCleanup.isPending && "animate-spin",
                      )}
                    />
                    Run Cleanup Now
                  </Button>
                </span>
              </TooltipTrigger>
              {!canMutate && (
                <TooltipContent>
                  Only available on the production deployment
                </TooltipContent>
              )}
            </Tooltip>
          </div>
        </div>

        {!canMutate && (
          <Card className="border-muted-foreground/30 bg-muted/30 gap-0">
            <CardContent className="flex items-center gap-3 py-3">
              <Clock className="size-4 shrink-0 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                This is a non-production environment. You can browse warnings
                but destructive actions (remove, run cleanup) are disabled.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {STAT_CARDS.map(
            ({ key, label, description, icon: Icon, iconBg, iconColor }) => (
              <Card key={key}>
                <CardContent className="flex items-start justify-between">
                  <div>
                    <CardDescription>{label}</CardDescription>
                    <CardTitle className="text-2xl">{stats[key]}</CardTitle>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {description}
                    </p>
                  </div>
                  <div
                    className={cn(
                      "flex size-12 items-center justify-center rounded-full",
                      iconBg,
                    )}
                  >
                    <Icon className={cn("size-6", iconColor)} />
                  </div>
                </CardContent>
              </Card>
            ),
          )}
        </div>

        {/* Filters */}
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
                  placeholder="Search by username..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                  className="pl-9"
                />
              </div>

              <Select
                value={statusFilter}
                onValueChange={(v) => {
                  setStatusFilter(v as WarningStatusFilter);
                  setPage(0);
                }}
              >
                <SelectTrigger className="min-w-[190px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_FILTER_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
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

        {/* Warnings Table */}
        <Card className="gap-0">
          <CardHeader className="border-b gap-0">
            <CardTitle>
              Inactivity Warnings ({total.toLocaleString()})
            </CardTitle>
          </CardHeader>

          {loading ? (
            <CardContent className="flex flex-1 items-center justify-center py-12">
              <Loading size="medium" text="Loading warnings..." />
            </CardContent>
          ) : error ? (
            <CardContent className="flex flex-1 items-center justify-center py-12">
              <div className="text-center">
                <p className="text-destructive">{error}</p>
                <Button
                  onClick={() => listQuery.refetch()}
                  className="mt-4"
                  variant="outline"
                >
                  Try Again
                </Button>
              </div>
            </CardContent>
          ) : warnings.length === 0 ? (
            <CardContent className="flex flex-1 items-center justify-center py-12">
              <div className="text-center">
                <Clock className="mx-auto size-12 text-muted-foreground" />
                <p className="mt-2 text-muted-foreground">No warnings found</p>
              </div>
            </CardContent>
          ) : (
            <>
              <CardContent className="px-0">
                <Table>
                  <TableHeader className="bg-sidebar-accent/50">
                    <TableRow>
                      <TableHead className="px-4">Player</TableHead>
                      <TableHead className="px-4">Status</TableHead>
                      <TableHead className="px-4">Warned</TableHead>
                      <TableHead className="px-4">Deadline</TableHead>
                      <TableHead className="px-4">Last Seen</TableHead>
                      <TableHead className="px-4 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {warnings.map((warning) => {
                      const status = deriveWarningStatus(warning, graceDays);
                      const daysLeft = daysUntilDeadline(
                        warning.warnedAt,
                        graceDays,
                      );
                      const canAct = !warning.resolvedAt && !warning.removedAt;
                      const warnedAtIso = toIso(warning.warnedAt);
                      const lastSeenIso = warning.lastSeen
                        ? toIso(warning.lastSeen)
                        : null;

                      return (
                        <TableRow key={warning.id}>
                          <TableCell className="px-4">
                            <div>
                              <p className="font-medium">
                                {warning.minecraftUsername ?? (
                                  <span className="text-muted-foreground italic">
                                    (deleted)
                                  </span>
                                )}
                              </p>
                              <p className="font-mono text-xs text-muted-foreground">
                                {warning.playerMinecraftUuid.slice(0, 8)}…
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="px-4">
                            <Badge
                              variant="outline"
                              className={STATUS_BADGE_CLASSES[status]}
                            >
                              {STATUS_LABELS[status]}
                            </Badge>
                          </TableCell>
                          <TableCell className="px-4">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-sm text-muted-foreground cursor-default">
                                  {formatRelativeDate(warnedAtIso)}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" align="start">
                                {formatFullDate(warnedAtIso)}
                              </TooltipContent>
                            </Tooltip>
                          </TableCell>
                          <TableCell className="px-4">
                            {status === "active" ? (
                              <p className="text-sm">
                                {daysLeft}d{" "}
                                <span className="text-muted-foreground">
                                  left
                                </span>
                              </p>
                            ) : status === "expired" ? (
                              <p className="text-sm text-destructive">
                                {Math.abs(daysLeft)}d overdue
                              </p>
                            ) : (
                              <p className="text-sm text-muted-foreground">—</p>
                            )}
                          </TableCell>
                          <TableCell className="px-4">
                            {lastSeenIso ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="text-sm text-muted-foreground cursor-default">
                                    {formatRelativeDate(lastSeenIso)}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" align="start">
                                  {formatFullDate(lastSeenIso)}
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              <p className="text-sm text-muted-foreground">—</p>
                            )}
                          </TableCell>
                          <TableCell className="px-4 text-right">
                            <div className="flex justify-end gap-2">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={!canAct}
                                      onClick={() =>
                                        setResolveModal({
                                          open: true,
                                          warning,
                                        })
                                      }
                                    >
                                      <UserCheck className="size-4" />
                                    </Button>
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>Resolve</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span>
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      className="cursor-pointer"
                                      disabled={!canAct || !canMutate}
                                      onClick={() =>
                                        setRemoveModal({
                                          open: true,
                                          warning,
                                        })
                                      }
                                    >
                                      <Trash2 className="size-4" />
                                    </Button>
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {canMutate
                                    ? "Remove now"
                                    : "Disabled in non-production"}
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>

              {/* Pagination */}
              <CardFooter className="flex-col gap-3 border-t sm:flex-row sm:flex-wrap sm:items-center">
                <p className="text-sm text-muted-foreground">
                  Showing {page * limit + 1}-
                  {Math.min((page + 1) * limit, total)} of {total} warnings
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

      {/* Modals */}
      {resolveModal.warning !== null && (
        <ResolveWarningModal
          open={resolveModal.open}
          onClose={() => setResolveModal({ open: false, warning: null })}
          warning={resolveModal.warning}
          onSuccess={handleSuccess}
        />
      )}

      {removeModal.warning !== null && (
        <RemoveWarningModal
          open={removeModal.open}
          onClose={() => setRemoveModal({ open: false, warning: null })}
          warning={removeModal.warning}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}
