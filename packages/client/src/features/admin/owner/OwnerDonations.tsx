import { useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CellDate, CellText } from "@/components/cell-text";
import {
  BadgeCellSkeleton,
  DataTable,
  loadingRowCount,
  type DataTableColumn,
} from "@/components/data-table";
import {
  Heart,
  Users,
  Euro,
  Search,
  Filter,
  Repeat,
  CalendarX,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { keepPreviousData } from "@tanstack/react-query";
import { trpc, type RouterOutput } from "@/lib/trpc";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { Loading } from "@/components/loading-spinner";

type Donation = RouterOutput["owner"]["donations"]["list"]["donations"][number];
type DonationStatus = "pending" | "completed" | "refunded" | "cancelled";
type DonationType = "one_time" | "monthly";

const STATUS_STYLES: Record<string, string> = {
  completed: "bg-green-500/10 text-green-500 border-green-500/20",
  pending: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  refunded: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  cancelled: "bg-muted text-muted-foreground border-border",
};

const TYPE_LABELS: Record<string, string> = {
  one_time: "One-time",
  monthly: "Monthly",
};

function formatAmount(cents: number, currency: string) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

const DONATION_COLUMNS: DataTableColumn<Donation>[] = [
  {
    key: "id",
    header: "ID",
    width: 90,
    cellClassName: "font-mono text-sm",
    render: (d) => d.id,
  },
  {
    key: "discord",
    header: "Discord",
    width: 210,
    render: (d) => (
      <CellText
        copy
        value={d.playerDiscordId}
        className="font-mono text-xs text-muted-foreground"
      />
    ),
  },
  {
    key: "type",
    header: "Type",
    width: 110,
    skeleton: () => <BadgeCellSkeleton />,
    render: (d) => (
      <Badge variant="outline" className="text-xs">
        {TYPE_LABELS[d.type] ?? d.type}
      </Badge>
    ),
  },
  {
    key: "amount",
    header: "Amount",
    width: 120,
    cellClassName: "font-semibold",
    render: (d) => formatAmount(d.amountCents, d.currency),
  },
  {
    key: "status",
    header: "Status",
    width: 120,
    skeleton: () => <BadgeCellSkeleton />,
    render: (d) => (
      <span
        className={cn(
          "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize",
          STATUS_STYLES[d.status] ?? STATUS_STYLES.pending,
        )}
      >
        {d.status}
      </span>
    ),
  },
  {
    key: "date",
    header: "Date",
    width: 120,
    render: (d) => <CellDate value={d.createdAt} />,
  },
];

export function OwnerDonations() {
  const [page, setPage] = useState(0);
  const limit = 20;
  const [discordIdInput, setDiscordIdInput] = useState("");
  const [statusFilter, setStatusFilter] = useState<DonationStatus | "all">(
    "all",
  );
  const [typeFilter, setTypeFilter] = useState<DonationType | "all">("all");
  const debouncedDiscordId = useDebouncedValue(discordIdInput, 1000);

  const statsQuery = trpc.owner.donations.stats.useQuery();
  const subStatsQuery = trpc.owner.donations.subscriptionStats.useQuery();
  const listQuery = trpc.owner.donations.list.useQuery(
    {
      page,
      limit,
      discordId: debouncedDiscordId || undefined,
      status: statusFilter !== "all" ? statusFilter : undefined,
    },
    { placeholderData: keepPreviousData },
  );

  const filteredDonations =
    typeFilter === "all"
      ? (listQuery.data?.donations ?? [])
      : (listQuery.data?.donations ?? []).filter((d) => d.type === typeFilter);

  const stats = statsQuery.data;
  const donations = filteredDonations;
  const pagination = listQuery.data?.pagination;
  const total = pagination?.total ?? 0;
  const totalPages = pagination
    ? Math.ceil(pagination.total / pagination.limit)
    : 0;
  const loading = listQuery.isLoading || listQuery.isPlaceholderData;
  const loadingRows = loadingRowCount(page, limit, total);
  const error = listQuery.error?.message ?? null;

  return (
    <div className="flex flex-1 flex-col gap-4">
      {/* Header */}
      <AdminPageHeader
        trail={[
          { label: "Home", href: "/" },
          { label: "Owner" },
          { label: "Donations" },
        ]}
      />

      <div className="mx-auto w-full max-w-[1400px] flex flex-1 flex-col gap-4 px-4 pb-4">
        {/* Stats */}
        {statsQuery.isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loading size="medium" text="Loading statistics..." />
          </div>
        ) : stats ? (
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="flex items-start justify-between">
                <div>
                  <CardDescription>Total Raised</CardDescription>
                  <CardTitle className="text-2xl">
                    {formatAmount(stats.totalRaisedCents, "EUR")}
                  </CardTitle>
                </div>
                <div className="flex size-12 items-center justify-center rounded-full bg-sidebar-primary/10">
                  <Euro className="size-6 text-sidebar-primary" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex items-start justify-between">
                <div>
                  <CardDescription>Unique Donors</CardDescription>
                  <CardTitle className="text-2xl">{stats.donorCount}</CardTitle>
                </div>
                <div className="flex size-12 items-center justify-center rounded-full bg-chart-2/10">
                  <Users className="size-6 text-chart-2" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex items-start justify-between">
                <div>
                  <CardDescription>Total Donations</CardDescription>
                  <CardTitle className="text-2xl">
                    {stats.donationCount}
                  </CardTitle>
                </div>
                <div className="flex size-12 items-center justify-center rounded-full bg-chart-3/10">
                  <Heart className="size-6 text-chart-3" />
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}

        {/* Subscription Stats */}
        {subStatsQuery.data && (
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="flex items-start justify-between">
                <div>
                  <CardDescription>Monthly Recurring Revenue</CardDescription>
                  <CardTitle className="text-2xl">
                    {formatAmount(subStatsQuery.data.mrrCents, "EUR")}
                  </CardTitle>
                </div>
                <div className="flex size-12 items-center justify-center rounded-full bg-sidebar-primary/10">
                  <Euro className="size-6 text-sidebar-primary" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex items-start justify-between">
                <div>
                  <CardDescription>Active Subscriptions</CardDescription>
                  <CardTitle className="text-2xl">
                    {subStatsQuery.data.activeCount}
                  </CardTitle>
                </div>
                <div className="flex size-12 items-center justify-center rounded-full bg-chart-2/10">
                  <Repeat className="size-6 text-chart-2" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex items-start justify-between">
                <div>
                  <CardDescription>Cancelling</CardDescription>
                  <CardTitle className="text-2xl">
                    {subStatsQuery.data.cancellingCount}
                  </CardTitle>
                </div>
                <div className="flex size-12 items-center justify-center rounded-full bg-chart-3/10">
                  <CalendarX className="size-6 text-chart-3" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <Card className="gap-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Filter className="size-4 text-muted-foreground" />
              Filters
              {(discordIdInput ||
                statusFilter !== "all" ||
                typeFilter !== "all") && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {(discordIdInput ? 1 : 0) +
                    (statusFilter !== "all" ? 1 : 0) +
                    (typeFilter !== "all" ? 1 : 0)}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search by Discord ID..."
                  value={discordIdInput}
                  onChange={(e) => {
                    setDiscordIdInput(e.target.value);
                    setPage(0);
                  }}
                  className="pl-9"
                />
              </div>

              <Select
                value={statusFilter}
                onValueChange={(v) => {
                  setStatusFilter(v as DonationStatus | "all");
                  setPage(0);
                }}
              >
                <SelectTrigger className="min-w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="refunded">Refunded</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={typeFilter}
                onValueChange={(v) => {
                  setTypeFilter(v as DonationType | "all");
                  setPage(0);
                }}
              >
                <SelectTrigger className="min-w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="one_time">One-time</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Donations Table */}
        <Card className="gap-0">
          <CardHeader className="border-b gap-0">
            <CardTitle>
              Donations
              {pagination?.total != null ? ` (${pagination.total})` : ""}
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
          ) : !loading && donations.length === 0 ? (
            <CardContent className="flex flex-1 items-center justify-center py-12">
              <div className="text-center">
                <Heart className="mx-auto size-12 text-muted-foreground" />
                <p className="mt-2 text-muted-foreground">No donations found</p>
              </div>
            </CardContent>
          ) : (
            <>
              <CardContent className="px-0">
                <DataTable
                  columns={DONATION_COLUMNS}
                  rows={donations}
                  loading={loading}
                  loadingRows={loadingRows}
                  rowKey={(d) => d.id}
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
                    itemLabel="donation"
                    className="w-full"
                  />
                </CardFooter>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
