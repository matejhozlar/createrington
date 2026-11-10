import { useCallback, useState } from "react";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/query-states";
import { StatCard } from "@/components/stat-card";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Paginator } from "@/components/paginator";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { CellDate, CellText } from "@/components/cell-text";
import {
  BadgeCellSkeleton,
  DataTable,
  loadingRowCount,
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
import {
  Search,
  Filter,
  Users,
  UserPlus,
  UserCheck,
  Clock,
  Trash2,
} from "lucide-react";
import type { WaitlistStatus } from "@createrington/shared/db";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { PromoteWaitlistModal } from "./components/modals/PromoteWaitlistModal";
import { DeleteWaitlistModal } from "./components/modals/DeleteWaitlistModal";
import { IntakeSettingsCard } from "./components/IntakeSettingsCard";
import { trpc, type RouterOutput } from "@/lib/trpc";

type WaitlistEntry =
  RouterOutput["admin"]["waitlists"]["list"]["entries"][number];

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
  const [page, setPage] = useState(0);
  const [limit] = useState(10);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const [orderBy, setOrderBy] = useState<SortField>("queuedAt");
  const [orderDirection, setOrderDirection] = useState<"asc" | "desc">("desc");

  const [promoteModal, setPromoteModal] = useState<{
    open: boolean;
    entry: WaitlistEntry | null;
  }>({ open: false, entry: null });
  const [deleteTarget, setDeleteTarget] = useState<WaitlistEntry | null>(null);

  const debouncedSearch = useDebouncedValue(searchQuery, 1000);

  const statsQuery = useQuery(trpc.admin.waitlists.stats.queryOptions());
  const stats = statsQuery.data ?? null;
  const statsLoading = statsQuery.isLoading;

  const search = debouncedSearch.trim();
  const searchIsId = /^\d{15,21}$/.test(search);

  const entriesQuery = useQuery(
    trpc.admin.waitlists.list.queryOptions(
      {
        page,
        limit,
        orderBy,
        orderDirection,
        discordUsername: search && !searchIsId ? search : undefined,
        discordId: searchIsId ? search : undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
      },
      { placeholderData: keepPreviousData },
    ),
  );

  const entries = entriesQuery.data?.entries ?? [];
  const total = entriesQuery.data?.pagination.total ?? 0;
  const totalPages = entriesQuery.data?.pagination.totalPages ?? 0;
  const loading = entriesQuery.isLoading || entriesQuery.isPlaceholderData;
  const loadingRows = loadingRowCount(page, limit, total);
  const error = entriesQuery.error?.message ?? null;

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
  }, []);

  const handleSort = useCallback(
    (field: SortField) => {
      if (orderBy === field) {
        setOrderDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      } else {
        setOrderBy(field);
        setOrderDirection("desc");
      }
      setPage(0);
    },
    [orderBy],
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
      sorted: orderBy === "discordUsername" ? orderDirection : false,
      onSort: () => handleSort("discordUsername"),
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
      sorted: orderBy === "queuedAt" ? orderDirection : false,
      onSort: () => handleSort("queuedAt"),
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
      {/* Header */}
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

        {/* Intake Settings */}
        <IntakeSettingsCard />

        {/* Filters & Search */}
        <Card className="gap-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Filter className="size-4 text-muted-foreground" />
              Filters
              {(searchQuery || statusFilter !== "all") && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {(searchQuery ? 1 : 0) + (statusFilter !== "all" ? 1 : 0)}
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
                  placeholder="Search by Discord username or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              <Select
                value={statusFilter}
                onValueChange={(v) => {
                  setStatusFilter(v as StatusFilter);
                  setPage(0);
                }}
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

              <Button type="submit" className="min-w-[85px]">
                Search
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Waitlist Table */}
        <Card className="gap-0">
          <CardHeader className="border-b gap-0">
            <CardTitle>Waitlist Entries ({total.toLocaleString()})</CardTitle>
          </CardHeader>

          {error ? (
            <ErrorState
              message={error}
              onRetry={() => entriesQuery.refetch()}
            />
          ) : !loading && entries.length === 0 ? (
            <EmptyState icon={Users} message="No waitlist entries found" />
          ) : (
            <>
              <CardContent className="px-0">
                <DataTable
                  columns={columns}
                  rows={entries}
                  loading={loading}
                  loadingRows={loadingRows}
                  rowKey={(entry) => entry.id}
                  actions={entryActions}
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

      {/* Modals */}
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
