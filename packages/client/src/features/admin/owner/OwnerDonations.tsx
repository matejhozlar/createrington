import { useState } from "react";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Paginator } from "@/components/paginator";
import { Badge, type BadgeTone } from "@/components/ui/badge";
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
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { trpc, type RouterOutput } from "@/lib/trpc";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/query-states";
import { StatCard } from "@/components/stat-card";

type Donation = RouterOutput["owner"]["donations"]["list"]["donations"][number];
type DonationStatus = "pending" | "completed" | "refunded" | "cancelled";
type DonationType = "one_time" | "monthly";

const STATUS_TONES: Record<string, BadgeTone> = {
  completed: "success",
  pending: "warning",
  refunded: "info",
  cancelled: "neutral",
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
      <Badge
        tone={STATUS_TONES[d.status] ?? STATUS_TONES.pending}
        className="capitalize"
      >
        {d.status}
      </Badge>
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

  const statsQuery = useQuery(trpc.owner.donations.stats.queryOptions());
  const subStatsQuery = useQuery(
    trpc.owner.donations.subscriptionStats.queryOptions(),
  );
  const listQuery = useQuery(
    trpc.owner.donations.list.queryOptions(
      {
        page,
        limit,
        discordId: debouncedDiscordId || undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
        type: typeFilter !== "all" ? typeFilter : undefined,
      },
      { placeholderData: keepPreviousData },
    ),
  );

  const stats = statsQuery.data;
  const donations = listQuery.data?.donations ?? [];
  const pagination = listQuery.data?.pagination;
  const total = pagination?.total ?? 0;
  const totalPages = pagination?.totalPages ?? 0;
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
        {statsQuery.isLoading ? (
          <LoadingState
            text="Loading statistics..."
            className="flex-none py-8"
          />
        ) : stats ? (
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard
              label="Total Raised"
              value={formatAmount(stats.totalRaisedCents, "EUR")}
              icon={Euro}
              tone="primary"
            />
            <StatCard
              label="Unique Donors"
              value={stats.donorCount}
              icon={Users}
              tone="chart-2"
            />
            <StatCard
              label="Total Donations"
              value={stats.donationCount}
              icon={Heart}
              tone="chart-3"
            />
          </div>
        ) : null}

        {subStatsQuery.data && (
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard
              label="Monthly Recurring Revenue"
              value={formatAmount(subStatsQuery.data.mrrCents, "EUR")}
              icon={Euro}
              tone="primary"
            />
            <StatCard
              label="Active Subscriptions"
              value={subStatsQuery.data.activeCount}
              icon={Repeat}
              tone="chart-2"
            />
            <StatCard
              label="Cancelling"
              value={subStatsQuery.data.cancellingCount}
              icon={CalendarX}
              tone="chart-3"
            />
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
            <ErrorState message={error} onRetry={() => listQuery.refetch()} />
          ) : !loading && donations.length === 0 ? (
            <EmptyState icon={Heart} message="No donations found" />
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
