import { useCallback, useMemo, useState } from "react";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { AdminPageTitle } from "@/features/admin/components/AdminPageTitle";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Paginator } from "@/components/paginator";
import { SearchInput } from "@/components/search-input";
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
  Trash2,
  UserCheck,
  UserX,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { keepPreviousData, useQuery, useMutation } from "@tanstack/react-query";
import { trpc, queryClient, type RouterOutput } from "@/lib/trpc";
import { useToastActions } from "@/hooks/use-toast";
import {
  formatFullDate,
  formatRelativeDate,
  toIso,
} from "@/features/admin/format";
import {
  STAT_CARDS,
  STATUS_TONES,
  STATUS_FILTER_OPTIONS,
  STATUS_LABELS,
  daysUntilDeadline,
  deriveWarningStatus,
  resolveStatText,
  type WarningStatusFilter,
} from "./constants";
import { ResolveWarningModal } from "./components/modals/ResolveWarningModal";
import { RemoveWarningModal } from "./components/modals/RemoveWarningModal";
import { ExemptionsCard } from "./components/ExemptionsCard";
import { GhostsCard } from "./components/GhostsCard";
import { UnlinkedMembersCard } from "./components/UnlinkedMembersCard";
import { EmptyState, ErrorState } from "@/components/query-states";
import { StatCard } from "@/components/stat-card";

type Warning = RouterOutput["admin"]["inactivity"]["list"]["warnings"][number];

const invalidateAfterRemovalRun = () => {
  void queryClient.invalidateQueries(trpc.admin.inactivity.pathFilter());
  void queryClient.invalidateQueries(trpc.admin.players.pathFilter());
};

export function InactivityManagement() {
  const toast = useToastActions();

  const [page, setPage] = useState(0);
  const [limit] = useState(20);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<WarningStatusFilter>("all");

  const [resolveTarget, setResolveTarget] = useState<Warning | null>(null);
  const [removeTarget, setRemoveTarget] = useState<Warning | null>(null);

  const debouncedSearch = useDebouncedValue(searchQuery);

  const capabilitiesQuery = useQuery(
    trpc.admin.inactivity.capabilities.queryOptions(),
  );
  const statsQuery = useQuery(trpc.admin.inactivity.stats.queryOptions());
  const listQuery = useQuery(
    trpc.admin.inactivity.list.queryOptions(
      {
        status: statusFilter,
        search: debouncedSearch.trim() || undefined,
        page,
        limit,
      },
      { placeholderData: keepPreviousData },
    ),
  );

  const triggerCleanup = useMutation(
    trpc.admin.inactivity.triggerCleanup.mutationOptions({
      onSuccess: invalidateAfterRemovalRun,
    }),
  );
  const triggerResolveRemove = useMutation(
    trpc.admin.inactivity.triggerResolveRemove.mutationOptions({
      onSuccess: invalidateAfterRemovalRun,
    }),
  );

  const warnings = listQuery.data?.warnings ?? [];
  const total = listQuery.data?.pagination.total ?? 0;
  const totalPages = listQuery.data?.pagination.totalPages ?? 0;
  const loading = listQuery.isLoading || listQuery.isPlaceholderData;
  const loadingRows = loadingRowCount(page, limit, total);
  const error = listQuery.error?.message ?? null;

  const canMutate = capabilitiesQuery.data?.canMutate ?? false;
  const graceDays = capabilitiesQuery.data?.graceDays ?? 14;
  const retentionDays = capabilitiesQuery.data?.retentionDays ?? 30;
  const statWindows = { graceDays, retentionDays };

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    // Reset pagination on every keystroke so the debounced query
    // below can't land on an out-of-range page when results shrink.
    setPage(0);
  }, []);

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
  }, []);

  const handleTriggerCleanup = useCallback(async () => {
    try {
      await triggerCleanup.mutateAsync();
      toast.success("Cleanup cycle completed");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to run cleanup cycle",
      );
    }
  }, [triggerCleanup, toast]);

  const handleProcessOverdue = useCallback(async () => {
    try {
      await triggerResolveRemove.mutateAsync();
      toast.success("Overdue warnings processed");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to process overdue warnings",
      );
    }
  }, [triggerResolveRemove, toast]);

  const stats = useMemo(
    () => ({
      active: statsQuery.data?.active ?? 0,
      expired: statsQuery.data?.expired ?? 0,
      resolvedInRetention: statsQuery.data?.resolvedInRetention ?? 0,
      removedInRetention: statsQuery.data?.removedInRetention ?? 0,
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
          <Badge tone={STATUS_TONES[status]}>{STATUS_LABELS[status]}</Badge>
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
        <AdminPageTitle
          title="Inactivity Management"
          actions={
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      className="w-full xs:w-auto"
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
                      className="w-full xs:w-auto"
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
            </>
          }
        />

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
          {STAT_CARDS.map(({ key, label, description, icon, tone }) => (
            <StatCard
              key={key}
              label={resolveStatText(label, statWindows)}
              value={stats[key]}
              icon={icon}
              tone={tone}
              footer={resolveStatText(description, statWindows)}
            />
          ))}
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
              <SearchInput
                className="min-w-48 flex-1"
                placeholder="Search by username..."
                value={searchQuery}
                onValueChange={handleSearchChange}
              />

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
            <ErrorState message={error} onRetry={() => listQuery.refetch()} />
          ) : !loading && warnings.length === 0 ? (
            <EmptyState icon={Clock} message="No warnings found" />
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

        <ExemptionsCard />

        {/* Ghost members (registered but missing from Discord) */}
        <GhostsCard canMutate={canMutate} />

        {/* Unlinked members (present on Discord but missing from the database) */}
        <UnlinkedMembersCard />
      </div>

      {/* Modals */}
      <ResolveWarningModal
        warning={resolveTarget}
        onClose={() => setResolveTarget(null)}
      />

      <RemoveWarningModal
        warning={removeTarget}
        onClose={() => setRemoveTarget(null)}
      />
    </div>
  );
}
