import { useCallback, useMemo, useState } from "react";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Paginator } from "@/components/paginator";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CellText } from "@/components/cell-text";
import {
  BadgeCellSkeleton,
  DataTable,
  loadingRowCount,
  TwoLineCellSkeleton,
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
  UserX,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { keepPreviousData } from "@tanstack/react-query";
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
import { GhostsCard } from "./components/GhostsCard";
import { UnlinkedMembersCard } from "./components/UnlinkedMembersCard";

type Warning = RouterOutput["admin"]["inactivity"]["list"]["warnings"][number];

/** Normalizes a tRPC-serialized timestamp to an ISO string. */
function toIso(value: string | Date): string {
  return typeof value === "string" ? value : new Date(value).toISOString();
}

export function InactivityManagement() {
  const toast = useToastActions();

  const [page, setPage] = useState(0);
  const [limit] = useState(20);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<WarningStatusFilter>("all");

  const [resolveTarget, setResolveTarget] = useState<Warning | null>(null);
  const [removeTarget, setRemoveTarget] = useState<Warning | null>(null);

  const debouncedSearch = useDebouncedValue(searchQuery, 500);

  const capabilitiesQuery = trpc.admin.inactivity.capabilities.useQuery();
  const statsQuery = trpc.admin.inactivity.stats.useQuery();
  const listQuery = trpc.admin.inactivity.list.useQuery(
    {
      status: statusFilter,
      search: debouncedSearch.trim() || undefined,
      page,
      limit,
    },
    { placeholderData: keepPreviousData },
  );

  const triggerCleanup = trpc.admin.inactivity.triggerCleanup.useMutation();
  const triggerResolveRemove =
    trpc.admin.inactivity.triggerResolveRemove.useMutation();

  // Destructure refetch so the callbacks below have stable deps: the
  // full query object is a new reference on every render.
  const { refetch: refetchList } = listQuery;
  const { refetch: refetchStats } = statsQuery;

  const warnings = listQuery.data?.warnings ?? [];
  const total = listQuery.data?.pagination.total ?? 0;
  const totalPages = listQuery.data?.pagination.totalPages ?? 0;
  const loading = listQuery.isLoading || listQuery.isPlaceholderData;
  const loadingRows = loadingRowCount(page, limit, total);
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

  const handleSuccess = useCallback(() => {
    setResolveTarget(null);
    setRemoveTarget(null);
    refetchList();
    refetchStats();
  }, [refetchList, refetchStats]);

  const handleTriggerCleanup = useCallback(async () => {
    try {
      await triggerCleanup.mutateAsync();
      toast.success("Cleanup cycle completed");
      refetchList();
      refetchStats();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to run cleanup cycle",
      );
    }
  }, [triggerCleanup, toast, refetchList, refetchStats]);

  const handleProcessOverdue = useCallback(async () => {
    try {
      await triggerResolveRemove.mutateAsync();
      toast.success("Overdue warnings processed");
      refetchList();
      refetchStats();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to process overdue warnings",
      );
    }
  }, [triggerResolveRemove, toast, refetchList, refetchStats]);

  const stats = useMemo(
    () => ({
      active: statsQuery.data?.active ?? 0,
      expired: statsQuery.data?.expired ?? 0,
      resolvedLast30d: statsQuery.data?.resolvedLast30d ?? 0,
      removedLast30d: statsQuery.data?.removedLast30d ?? 0,
    }),
    [statsQuery.data],
  );

  const columns: DataTableColumn<Warning>[] = [
    {
      key: "player",
      header: "Player",
      minWidth: 180,
      skeleton: () => <TwoLineCellSkeleton />,
      render: (warning) => (
        <div className="min-w-0">
          {warning.minecraftUsername ? (
            <CellText
              value={warning.minecraftUsername}
              className="font-medium"
            />
          ) : (
            <p className="italic text-muted-foreground">(deleted)</p>
          )}
          <CellText
            value={warning.playerMinecraftUuid}
            display={`${warning.playerMinecraftUuid.slice(0, 8)}…`}
            className="font-mono text-xs text-muted-foreground"
          />
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: 120,
      skeleton: () => <BadgeCellSkeleton />,
      render: (warning) => {
        const status = deriveWarningStatus(warning, graceDays);
        return (
          <Badge variant="outline" className={STATUS_BADGE_CLASSES[status]}>
            {STATUS_LABELS[status]}
          </Badge>
        );
      },
    },
    {
      key: "warned",
      header: "Warned",
      width: 140,
      cellClassName: "text-sm text-muted-foreground",
      render: (warning) => {
        const iso = toIso(warning.warnedAt);
        return (
          <CellText
            value={formatFullDate(iso)}
            display={formatRelativeDate(iso)}
          />
        );
      },
    },
    {
      key: "deadline",
      header: "Deadline",
      width: 120,
      render: (warning) => {
        const status = deriveWarningStatus(warning, graceDays);
        const daysLeft = daysUntilDeadline(warning.warnedAt, graceDays);
        if (status === "active") {
          return (
            <p className="text-sm">
              {daysLeft}d <span className="text-muted-foreground">left</span>
            </p>
          );
        }
        if (status === "expired") {
          return (
            <p className="text-sm text-destructive">
              {Math.abs(daysLeft)}d overdue
            </p>
          );
        }
        return null;
      },
    },
    {
      key: "lastSeen",
      header: "Last Seen",
      width: 140,
      cellClassName: "text-sm text-muted-foreground",
      render: (warning) => {
        if (!warning.lastSeen) return null;
        const iso = toIso(warning.lastSeen);
        return (
          <CellText
            value={formatFullDate(iso)}
            display={formatRelativeDate(iso)}
          />
        );
      },
    },
  ];

  return (
    <div className="flex flex-1 flex-col gap-4">
      {/* Header */}
      <AdminPageHeader
        trail={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Tools", href: "/admin/tools" },
          { label: "Inactivity Management" },
        ]}
      />

      <div className="mx-auto w-full max-w-[1400px] flex flex-1 flex-col gap-4 px-4 pb-4">
        {/* Title + Actions */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-semibold">Inactivity Management</h1>
          <div className="flex flex-wrap gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    variant="outline"
                    onClick={handleProcessOverdue}
                    disabled={!canMutate}
                    loading={triggerResolveRemove.isPending}
                  >
                    <UserX className="mr-2 size-4" />
                    Process Overdue
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {canMutate
                  ? "Run resolve + remove phases only — no new warning announcements"
                  : "Only available on the production deployment"}
              </TooltipContent>
            </Tooltip>
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
              <TooltipContent>
                {canMutate
                  ? "Run the full cycle: resolve → warn → remove"
                  : "Only available on the production deployment"}
              </TooltipContent>
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

          {error ? (
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
          ) : !loading && warnings.length === 0 ? (
            <CardContent className="flex flex-1 items-center justify-center py-12">
              <div className="text-center">
                <Clock className="mx-auto size-12 text-muted-foreground" />
                <p className="mt-2 text-muted-foreground">No warnings found</p>
              </div>
            </CardContent>
          ) : (
            <>
              <CardContent className="px-0">
                <DataTable
                  columns={columns}
                  rows={warnings}
                  loading={loading}
                  loadingRows={loadingRows}
                  rowKey={(warning) => warning.id}
                  actions={(warning) => {
                    const canAct = !warning.resolvedAt && !warning.removedAt;
                    return [
                      {
                        label: "Resolve",
                        icon: UserCheck,
                        disabled: !canAct,
                        onClick: () => setResolveTarget(warning),
                      },
                      {
                        label: canMutate
                          ? "Remove now"
                          : "Only available on the production deployment",
                        icon: Trash2,
                        variant: "destructive",
                        disabled: !canAct || !canMutate,
                        onClick: () => setRemoveTarget(warning),
                      },
                    ];
                  }}
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
                    itemLabel="warning"
                    className="w-full"
                  />
                </CardFooter>
              )}
            </>
          )}
        </Card>

        {/* Ghost members (registered but missing from Discord) */}
        <GhostsCard canMutate={canMutate} />

        {/* Unlinked members (present on Discord but missing from the database) */}
        <UnlinkedMembersCard />
      </div>

      {/* Modals */}
      <ResolveWarningModal
        warning={resolveTarget}
        onClose={() => setResolveTarget(null)}
        onSuccess={handleSuccess}
      />

      <RemoveWarningModal
        warning={removeTarget}
        onClose={() => setRemoveTarget(null)}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
