import { useCallback, useState } from "react";
import { Loading } from "@/components/loading-spinner";
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
import { keepPreviousData } from "@tanstack/react-query";
import { PromoteWaitlistModal } from "./components/modals/PromoteWaitlistModal";
import { DeleteWaitlistModal } from "./components/modals/DeleteWaitlistModal";
import { IntakeSettingsCard } from "./components/IntakeSettingsCard";
import { trpc, type RouterOutput } from "@/lib/trpc";

type WaitlistEntry =
  RouterOutput["admin"]["waitlists"]["list"]["entries"][number];

type SortField = "queuedAt" | "promotedAt" | "discordUsername";
type StatusFilter = "all" | WaitlistStatus;

const STATUS_LABELS: Record<WaitlistStatus, string> = {
  queued: "Queued",
  promoted: "Promoted",
  registered: "Registered",
  expired: "Expired",
};

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

  const statsQuery = trpc.admin.waitlists.stats.useQuery();
  const stats = statsQuery.data ?? null;
  const statsLoading = statsQuery.isLoading;

  const search = debouncedSearch.trim();
  const searchIsId = /^\d{15,21}$/.test(search);

  const entriesQuery = trpc.admin.waitlists.list.useQuery(
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

  const handlePromoteSuccess = useCallback(() => {
    setPromoteModal({ open: false, entry: null });
    entriesQuery.refetch();
    statsQuery.refetch();
  }, [entriesQuery, statsQuery]);

  const handleDeleteSuccess = useCallback(() => {
    setDeleteTarget(null);
    entriesQuery.refetch();
    statsQuery.refetch();
  }, [entriesQuery, statsQuery]);

  const getStatusBadgeStyle = useCallback((status: WaitlistStatus) => {
    switch (status) {
      case "registered":
        return {
          variant: "outline" as const,
          className: "border-success bg-success/10 text-success",
        };
      case "promoted":
        return {
          variant: "outline" as const,
          className: "border-chart-2 bg-chart-2/10 text-chart-2",
        };
      case "expired":
        return {
          variant: "outline" as const,
          className: "border-muted-foreground/40 text-muted-foreground",
        };
      default: // queued
        return {
          variant: "outline" as const,
          className: "border-amber-500 bg-amber-500/10 text-amber-500",
        };
    }
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
          <Badge
            variant={getStatusBadgeStyle(entry.status).variant}
            className={getStatusBadgeStyle(entry.status).className}
          >
            {STATUS_LABELS[entry.status]}
          </Badge>
          {entry.joinedMinecraft && (
            <Badge
              variant="outline"
              className="border-success bg-success/10 text-success text-xs"
            >
              In-Game
            </Badge>
          )}
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
        {/* Stats Cards */}
        {statsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loading size="medium" text="Loading statistics..." />
          </div>
        ) : stats ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="flex items-start justify-between">
                <div>
                  <CardDescription>In Queue</CardDescription>
                  <CardTitle className="text-2xl">{stats.queued}</CardTitle>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {stats.total} entries total
                  </p>
                </div>
                <div className="flex size-12 items-center justify-center rounded-full bg-sidebar-primary/10">
                  <Users className="size-6 text-sidebar-primary" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex items-start justify-between">
                <div>
                  <CardDescription>Promoted</CardDescription>
                  <CardTitle className="text-2xl">{stats.promoted}</CardTitle>
                  <p className="mt-2 text-xs text-muted-foreground">
                    awaiting registration
                  </p>
                </div>
                <div className="flex size-12 items-center justify-center rounded-full bg-chart-2/10">
                  <Clock className="size-6 text-chart-2" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex items-start justify-between">
                <div>
                  <CardDescription>Registered</CardDescription>
                  <CardTitle className="text-2xl">{stats.registered}</CardTitle>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {stats.joinedMinecraft} joined Minecraft
                  </p>
                </div>
                <div className="flex size-12 items-center justify-center rounded-full bg-chart-4/10">
                  <UserCheck className="size-6 text-chart-4" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex items-start justify-between">
                <div>
                  <CardDescription>New This Week</CardDescription>
                  <CardTitle className="text-2xl">
                    {stats.submitted.thisWeek}
                  </CardTitle>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {stats.submitted.today} today
                  </p>
                </div>
                <div className="flex size-12 items-center justify-center rounded-full bg-chart-3/10">
                  <UserPlus className="size-6 text-chart-3" />
                </div>
              </CardContent>
            </Card>
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
            <CardContent className="flex flex-1 items-center justify-center py-12">
              <div className="text-center">
                <p className="text-destructive">{error}</p>
                <Button
                  onClick={() => entriesQuery.refetch()}
                  className="mt-4"
                  variant="outline"
                >
                  Try Again
                </Button>
              </div>
            </CardContent>
          ) : !loading && entries.length === 0 ? (
            <CardContent className="flex flex-1 items-center justify-center py-12">
              <div className="text-center">
                <Users className="mx-auto size-12 text-muted-foreground" />
                <p className="mt-2 text-muted-foreground">
                  No waitlist entries found
                </p>
              </div>
            </CardContent>
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
          onSuccess={handlePromoteSuccess}
        />
      )}

      <DeleteWaitlistModal
        entry={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onSuccess={handleDeleteSuccess}
      />
    </div>
  );
}
