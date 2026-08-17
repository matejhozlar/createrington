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
import { Sensitive } from "@/components/sensitive";
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
  Mail,
  Trash2,
} from "lucide-react";
import type { WaitlistStatus } from "@createrington/shared/db";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { keepPreviousData } from "@tanstack/react-query";
import { InviteWaitlistModal } from "./components/modals/InviteWaitlistModal";
import { DeleteWaitlistModal } from "./components/modals/DeleteWaitlistModal";
import { trpc, type RouterOutput } from "@/lib/trpc";

type WaitlistEntry =
  RouterOutput["admin"]["waitlists"]["list"]["entries"][number];

type SortField = "submittedAt" | "acceptedAt" | "email" | "discordName";
type StatusFilter = "all" | WaitlistStatus;

const STATUS_LABELS: Record<WaitlistStatus, string> = {
  pending: "Pending",
  accepted: "Invited",
  auto_accepted: "Auto-accepted",
  completed: "Completed",
  declined: "Declined",
};

const PROGRESS_STEPS: { key: keyof WaitlistEntry; label: string }[] = [
  { key: "joinedMinecraft", label: "In-Game" },
  { key: "registered", label: "Registered" },
  { key: "verified", label: "Verified" },
  { key: "joinedDiscord", label: "Discord" },
];

export function AdminWaitlists() {
  const [page, setPage] = useState(0);
  const [limit] = useState(10);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [verifiedFilter, setVerifiedFilter] = useState<boolean | undefined>(
    undefined,
  );

  const [orderBy, setOrderBy] = useState<SortField>("submittedAt");
  const [orderDirection, setOrderDirection] = useState<"asc" | "desc">("desc");

  const [inviteModal, setInviteModal] = useState<{
    open: boolean;
    entry: WaitlistEntry | null;
  }>({ open: false, entry: null });
  const [deleteModal, setDeleteModal] = useState<{
    open: boolean;
    entry: WaitlistEntry | null;
  }>({ open: false, entry: null });

  const debouncedSearch = useDebouncedValue(searchQuery, 1000);

  const statsQuery = trpc.admin.waitlists.stats.useQuery();
  const stats = statsQuery.data ?? null;
  const statsLoading = statsQuery.isLoading;

  const entriesQuery = trpc.admin.waitlists.list.useQuery(
    {
      page,
      limit,
      orderBy,
      orderDirection,
      email: debouncedSearch.trim() || undefined,
      discordName: debouncedSearch.trim() || undefined,
      status: statusFilter !== "all" ? statusFilter : undefined,
      verified: verifiedFilter,
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

  const handleInvite = useCallback((entry: WaitlistEntry) => {
    setInviteModal({ open: true, entry });
  }, []);

  const handleDelete = useCallback((entry: WaitlistEntry) => {
    setDeleteModal({ open: true, entry });
  }, []);

  const handleInviteSuccess = useCallback(() => {
    setInviteModal({ open: false, entry: null });
    entriesQuery.refetch();
    statsQuery.refetch();
  }, [entriesQuery, statsQuery]);

  const handleDeleteSuccess = useCallback(() => {
    setDeleteModal({ open: false, entry: null });
    entriesQuery.refetch();
    statsQuery.refetch();
  }, [entriesQuery, statsQuery]);

  const getStatusBadgeStyle = useCallback((status: string) => {
    switch (status.toLowerCase()) {
      case "accepted":
        return {
          variant: "outline" as const,
          className: "border-success bg-success/10 text-success",
        };
      case "auto_accepted":
        return {
          variant: "outline" as const,
          className: "border-chart-2 bg-chart-2/10 text-chart-2",
        };
      case "declined":
        return {
          variant: "destructive" as const,
          className: "",
        };
      default: // pending
        return {
          variant: "outline" as const,
          className: "",
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
      key: "email",
      header: "Email",
      minWidth: 200,
      sorted: orderBy === "email" ? orderDirection : false,
      onSort: () => handleSort("email"),
      render: (entry) =>
        entry.email && (
          <div className="flex min-w-0 items-center gap-2">
            <Mail className="size-4 shrink-0 text-muted-foreground" />
            <Sensitive value={entry.email} label="email" className="text-sm" />
          </div>
        ),
    },
    {
      key: "discordName",
      header: "Discord Name",
      minWidth: 160,
      sorted: orderBy === "discordName" ? orderDirection : false,
      onSort: () => handleSort("discordName"),
      skeleton: () => <TwoLineCellSkeleton />,
      render: (entry) => (
        <>
          <CellText value={entry.discordName ?? ""} className="font-medium" />
          {entry.discordId && (
            <CellText
              value={`ID: ${entry.discordId}`}
              className="text-xs text-muted-foreground"
            />
          )}
        </>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: 132,
      skeleton: () => <BadgeCellSkeleton />,
      render: (entry) => (
        <Badge
          variant={getStatusBadgeStyle(entry.status).variant}
          className={getStatusBadgeStyle(entry.status).className}
        >
          {STATUS_LABELS[entry.status]}
        </Badge>
      ),
    },
    {
      key: "progress",
      header: "Progress",
      width: 110,
      skeleton: () => <BadgeCellSkeleton />,
      render: (entry) => {
        const step = PROGRESS_STEPS.find(({ key }) => entry[key]);
        return (
          step && (
            <Badge
              variant="outline"
              className="border-success bg-success/10 text-success text-xs"
            >
              {step.label}
            </Badge>
          )
        );
      },
    },
    {
      key: "submitted",
      header: "Submitted",
      width: 160,
      sorted: orderBy === "submittedAt" ? orderDirection : false,
      onSort: () => handleSort("submittedAt"),
      skeleton: () => <TwoLineCellSkeleton />,
      render: (entry) => (
        <>
          <CellDate value={entry.submittedAt} />
          {entry.acceptedAt && (
            <div className="flex gap-1 text-xs text-muted-foreground">
              <span>Accepted:</span>
              <CellDate value={entry.acceptedAt} className="text-xs" />
            </div>
          )}
        </>
      ),
    },
  ];

  const entryActions = (entry: WaitlistEntry): DataTableAction[] => {
    const actions: DataTableAction[] = [];
    if (entry.status === "pending") {
      actions.push({
        label: "Invite",
        icon: UserPlus,
        onClick: () => handleInvite(entry),
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
                  <CardDescription>Total Entries</CardDescription>
                  <CardTitle className="text-2xl">{stats.total}</CardTitle>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {stats.pending} pending approval
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
                  <CardDescription>Accepted</CardDescription>
                  <CardTitle className="text-2xl">
                    {stats.accepted + stats.autoAccepted}
                  </CardTitle>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {stats.autoAccepted} auto-accepted &middot;{" "}
                    {stats.joinedMinecraft} joined Minecraft
                  </p>
                </div>
                <div className="flex size-12 items-center justify-center rounded-full bg-chart-2/10">
                  <UserCheck className="size-6 text-chart-2" />
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

            <Card>
              <CardContent className="flex items-start justify-between">
                <div>
                  <CardDescription>Verified</CardDescription>
                  <CardTitle className="text-2xl">{stats.verified}</CardTitle>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {stats.registered} registered
                  </p>
                </div>
                <div className="flex size-12 items-center justify-center rounded-full bg-chart-4/10">
                  <Clock className="size-6 text-chart-4" />
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}

        {/* Filters & Search */}
        <Card className="gap-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Filter className="size-4 text-muted-foreground" />
              Filters
              {(searchQuery ||
                statusFilter !== "all" ||
                verifiedFilter !== undefined) && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {(searchQuery ? 1 : 0) +
                    (statusFilter !== "all" ? 1 : 0) +
                    (verifiedFilter !== undefined ? 1 : 0)}
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
                  placeholder="Search by email or Discord name..."
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
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="accepted">Accepted</SelectItem>
                  <SelectItem value="auto_accepted">Auto-Accepted</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={
                  verifiedFilter === undefined
                    ? "all"
                    : verifiedFilter
                      ? "verified"
                      : "unverified"
                }
                onValueChange={(v) => {
                  setVerifiedFilter(v === "all" ? undefined : v === "verified");
                  setPage(0);
                }}
              >
                <SelectTrigger className="min-w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Verification</SelectItem>
                  <SelectItem value="verified">Verified</SelectItem>
                  <SelectItem value="unverified">Unverified</SelectItem>
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
      {inviteModal.entry !== null && (
        <InviteWaitlistModal
          open={inviteModal.open}
          onClose={() => setInviteModal({ open: false, entry: null })}
          entry={inviteModal.entry}
          onSuccess={handleInviteSuccess}
        />
      )}

      {deleteModal.entry !== null && (
        <DeleteWaitlistModal
          open={deleteModal.open}
          onClose={() => setDeleteModal({ open: false, entry: null })}
          entry={deleteModal.entry}
          onSuccess={handleDeleteSuccess}
        />
      )}
    </div>
  );
}
