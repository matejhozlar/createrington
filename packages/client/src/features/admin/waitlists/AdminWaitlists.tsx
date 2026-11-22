import { useCallback, useState } from "react";
import { LoadingState } from "@/components/query-states";
import { StatCard } from "@/components/stat-card";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { FilterBar } from "@/features/admin/components/FilterBar";
import { TableCard } from "@/components/paged-table";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { CellDate, CellText } from "@/components/cell-text";
import {
  BadgeCellSkeleton,
  TwoLineCellSkeleton,
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
import { Users, UserPlus, UserCheck, Clock, Trash2 } from "lucide-react";
import type { WaitlistStatus } from "@createrington/shared/db";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { usePagedQuery } from "@/hooks/use-paged-query";
import { useTableSort } from "@/hooks/use-table-sort";
import { useQuery } from "@tanstack/react-query";
import { PromoteWaitlistModal } from "./components/modals/PromoteWaitlistModal";
import { DeleteWaitlistModal } from "./components/modals/DeleteWaitlistModal";
import { IntakeSettingsCard } from "./components/IntakeSettingsCard";
import { trpc, type RouterOutput } from "@/lib/trpc";

type WaitlistEntry =
  RouterOutput["admin"]["waitlists"]["list"]["items"][number];

type SortField = "createdAt" | "queuedAt" | "promotedAt" | "discordUsername";
type StatusFilter = "all" | WaitlistStatus;

const STATUS_LABELS: Record<WaitlistStatus, string> = {
  queued: "Queued",
  promoted: "Promoted",
  registered: "Registered",
  expired: "Expired",
};

const STATUS_TONES: Record<WaitlistStatus, BadgeTone> = {
  queued: "warning",
  promoted: "teal",
  registered: "success",
  expired: "neutral",
};

function hasRequeued(entry: WaitlistEntry) {
  return (
    new Date(entry.createdAt).getTime() !== new Date(entry.queuedAt).getTime()
  );
}

export function AdminWaitlists() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const sort = useTableSort<SortField>("queuedAt", {
    newFieldDirection: "desc",
  });

  const [promoteModal, setPromoteModal] = useState<{
    open: boolean;
    entry: WaitlistEntry | null;
  }>({ open: false, entry: null });
  const [deleteTarget, setDeleteTarget] = useState<WaitlistEntry | null>(null);

  const debouncedSearch = useDebouncedValue(searchQuery);

  const statsQuery = useQuery(trpc.admin.waitlists.stats.queryOptions());
  const stats = statsQuery.data ?? null;
  const statsLoading = statsQuery.isLoading;

  const search = debouncedSearch.trim();
  const searchIsId = /^\d{15,21}$/.test(search);

  const entries = usePagedQuery(
    {
      ...sort.order,
      discordUsername: search && !searchIsId ? search : undefined,
      discordId: searchIsId ? search : undefined,
      status: statusFilter !== "all" ? statusFilter : undefined,
    },
    (input) => trpc.admin.waitlists.list.queryOptions(input),
    10,
  );

  const handlePromote = useCallback((entry: WaitlistEntry) => {
    setPromoteModal({ open: true, entry });
  }, []);

  const handleDelete = useCallback((entry: WaitlistEntry) => {
    setDeleteTarget(entry);
  }, []);

  const columns: DataTableColumn<WaitlistEntry>[] = [
    {
      key: "id",
      header: "ID",
      width: 70,
      render: (entry) => <p className="font-mono text-sm">#{entry.id}</p>,
    },
    {
      key: "discordUsername",
      header: "Member",
      minWidth: 180,
      ...sort.column("discordUsername"),
      skeleton: () => <TwoLineCellSkeleton />,
      render: (entry) => (
        <>
          <CellText value={entry.discordUsername} className="font-medium" />
          <CellText
            value={`ID: ${entry.discordId}`}
            className="text-xs text-muted-foreground"
          />
        </>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: 160,
      skeleton: () => <BadgeCellSkeleton />,
      render: (entry) => (
        <div className="flex items-center gap-1.5">
          <Badge tone={STATUS_TONES[entry.status]}>
            {STATUS_LABELS[entry.status]}
          </Badge>
          {entry.joinedMinecraft && <Badge tone="success">In-Game</Badge>}
        </div>
      ),
    },
    {
      key: "queued",
      header: "Queued",
      width: 170,
      ...sort.column("queuedAt"),
      skeleton: () => <TwoLineCellSkeleton />,
      render: (entry) => (
        <>
          <CellDate value={entry.queuedAt} />
          {hasRequeued(entry) && (
            <div className="flex gap-1 text-xs text-muted-foreground">
              <span>Signed up:</span>
              <CellDate value={entry.createdAt} className="text-xs" />
            </div>
          )}
          {entry.promotedAt && (
            <div className="flex gap-1 text-xs text-muted-foreground">
              <span>Promoted:</span>
              <CellDate value={entry.promotedAt} className="text-xs" />
            </div>
          )}
        </>
      ),
    },
    {
      key: "registered",
      header: "Registered",
      width: 140,
      skeleton: () => <TwoLineCellSkeleton />,
      render: (entry) =>
        entry.registeredAt && <CellDate value={entry.registeredAt} />,
    },
  ];

  const entryActions = (entry: WaitlistEntry): DataTableAction[] => {
    const actions: DataTableAction[] = [];
    if (entry.status === "queued") {
      actions.push({
        label: "Promote",
        icon: UserPlus,
        onClick: () => handlePromote(entry),
      });
    }
    actions.push({
      label: "Delete",
      icon: Trash2,
      variant: "destructive",
      onClick: () => handleDelete(entry),
    });
    return actions;
  };

  return (
    <div className="flex flex-1 flex-col gap-4">
      <AdminPageHeader
        trail={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Waitlist" },
        ]}
      />

      <div className="mx-auto w-full max-w-[1400px] flex flex-1 flex-col gap-4 px-4 pb-4">
        {statsLoading ? (
          <LoadingState
            text="Loading statistics..."
            className="flex-none py-8"
          />
        ) : stats ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="In Queue"
              value={stats.queued}
              icon={Users}
              tone="primary"
              footer={`${stats.total} entries total`}
            />
            <StatCard
              label="Promoted"
              value={stats.promoted}
              icon={Clock}
              tone="chart-2"
              footer="awaiting registration"
            />
            <StatCard
              label="Registered"
              value={stats.registered}
              icon={UserCheck}
              tone="chart-4"
              footer={`${stats.joinedMinecraft} joined Minecraft`}
            />
            <StatCard
              label="New This Week"
              value={stats.signups.thisWeek}
              icon={UserPlus}
              tone="chart-3"
              footer={`${stats.signups.today} today`}
            />
          </div>
        ) : null}

        <IntakeSettingsCard />

        <FilterBar
          search={searchQuery}
          onSearchChange={setSearchQuery}
          placeholder="Search by Discord username or ID..."
          activeCount={(searchQuery ? 1 : 0) + (statusFilter !== "all" ? 1 : 0)}
        >
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as StatusFilter)}
          >
            <SelectTrigger className="min-w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="queued">Queued</SelectItem>
              <SelectItem value="promoted">Promoted</SelectItem>
              <SelectItem value="registered">Registered</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>
        </FilterBar>

        <TableCard
          title="Waitlist Entries"
          paged={entries}
          empty={{ icon: Users, message: "No waitlist entries found" }}
          itemLabel="entry"
          columns={columns}
          rowKey={(entry) => entry.id}
          actions={entryActions}
        />
      </div>

      {promoteModal.entry !== null && (
        <PromoteWaitlistModal
          open={promoteModal.open}
          onClose={() => setPromoteModal({ open: false, entry: null })}
          entry={promoteModal.entry}
        />
      )}

      <DeleteWaitlistModal
        entry={deleteTarget}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
