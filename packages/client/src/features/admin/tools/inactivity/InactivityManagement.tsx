import { useMemo, useState } from "react";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { AdminPageTitle } from "@/features/admin/components/AdminPageTitle";
import { FilterBar } from "@/features/admin/components/FilterBar";
import { Card, CardContent } from "@/components/ui/card";
import { TableCard } from "@/components/paged-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CellDate, CellText } from "@/components/cell-text";
import {
  BadgeCellSkeleton,
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
import { Clock, RefreshCw, Trash2, UserCheck, UserX } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { usePagedQuery } from "@/hooks/use-paged-query";
import { useQuery, useMutation } from "@tanstack/react-query";
import { trpc, queryClient, type RouterOutput } from "@/lib/trpc";
import { useMutationToast } from "@/hooks/use-mutation-toast";
import {
  DEFAULT_STAT_WINDOWS,
  STAT_CARDS,
  STATUS_TONES,
  STATUS_FILTER_OPTIONS,
  STATUS_LABELS,
  type WarningStatusFilter,
} from "./constants";
import {
  daysUntilDeadline,
  deriveWarningStatus,
  resolveStatText,
} from "./status";
import { ResolveWarningModal } from "./components/modals/ResolveWarningModal";
import { RemoveWarningModal } from "./components/modals/RemoveWarningModal";
import { ExemptionsCard } from "./components/ExemptionsCard";
import { GhostsCard } from "./components/GhostsCard";
import { UnlinkedMembersCard } from "./components/UnlinkedMembersCard";
import { StatCard } from "@/components/stat-card";

type Warning = RouterOutput["admin"]["inactivity"]["list"]["items"][number];

const invalidateAfterRemovalRun = () => {
  void queryClient.invalidateQueries(trpc.admin.inactivity.pathFilter());
  void queryClient.invalidateQueries(trpc.admin.players.pathFilter());
};

export function InactivityManagement() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<WarningStatusFilter>("all");

  const [resolveTarget, setResolveTarget] = useState<Warning | null>(null);
  const [removeTarget, setRemoveTarget] = useState<Warning | null>(null);

  const debouncedSearch = useDebouncedValue(searchQuery);

  const capabilitiesQuery = useQuery(
    trpc.admin.inactivity.capabilities.queryOptions(),
  );
  const statsQuery = useQuery(trpc.admin.inactivity.stats.queryOptions());
  const warnings = usePagedQuery(
    {
      status: statusFilter,
      search: debouncedSearch.trim() || undefined,
    },
    (input) => trpc.admin.inactivity.list.queryOptions(input),
  );

  const triggerCleanup = useMutation(
    trpc.admin.inactivity.triggerCleanup.mutationOptions(
      useMutationToast({
        success: "Cleanup cycle completed",
        onSuccess: invalidateAfterRemovalRun,
      }),
    ),
  );
  const triggerResolveRemove = useMutation(
    trpc.admin.inactivity.triggerResolveRemove.mutationOptions(
      useMutationToast({
        success: "Overdue warnings processed",
        onSuccess: invalidateAfterRemovalRun,
      }),
    ),
  );

  const canMutate = capabilitiesQuery.data?.canMutate ?? false;
  const graceDays =
    capabilitiesQuery.data?.graceDays ?? DEFAULT_STAT_WINDOWS.graceDays;
  const retentionDays =
    capabilitiesQuery.data?.retentionDays ?? DEFAULT_STAT_WINDOWS.retentionDays;
  const statWindows = { graceDays, retentionDays };

  const handleTriggerCleanup = () => triggerCleanup.mutate();

  const handleProcessOverdue = () => triggerResolveRemove.mutate();

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
      render: (warning) => <CellDate value={warning.warnedAt} relative />,
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
      render: (warning) => <CellDate value={warning.lastSeen} relative />,
    },
  ];

  return (
    <div className="flex flex-1 flex-col gap-4">
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

        <FilterBar
          search={searchQuery}
          onSearchChange={setSearchQuery}
          placeholder="Search by username..."
          activeCount={(searchQuery ? 1 : 0) + (statusFilter !== "all" ? 1 : 0)}
        >
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as WarningStatusFilter)}
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
        </FilterBar>

        <TableCard
          title="Inactivity Warnings"
          paged={warnings}
          empty={{ icon: Clock, message: "No warnings found" }}
          itemLabel="warning"
          columns={columns}
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

        <ExemptionsCard />

        <GhostsCard canMutate={canMutate} />

        <UnlinkedMembersCard />
      </div>

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
