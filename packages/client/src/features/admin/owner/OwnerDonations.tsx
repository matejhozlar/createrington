import { useState } from "react";
import { AdminPage } from "@/features/admin/components/AdminPage";
import { AdminPageTitle } from "@/features/admin/components/AdminPageTitle";
import { FilterBar } from "@/features/admin/components/FilterBar";
import { TableCard } from "@/components/paged-table";
import { Badge, type BadgeTone } from "@/components/ui/badge";
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
  type DataTableColumn,
} from "@/components/data-table";
import { Heart, Users, Euro, Repeat, CalendarX } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { usePagedQuery } from "@/hooks/use-paged-query";
import { trpc, type RouterOutput } from "@/lib/trpc";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { ErrorState, LoadingState } from "@/components/query-states";
import { StatCard } from "@/components/stat-card";
import {
  DONATION_STATUSES,
  type DonationStatus,
} from "@createrington/shared/donation";

type Donation = RouterOutput["owner"]["donations"]["list"]["items"][number];
type DonationType = Donation["type"];

const STATUS_DISPLAY: Record<
  DonationStatus,
  { label: string; tone: BadgeTone }
> = {
  completed: { label: "Completed", tone: "success" },
  pending: { label: "Pending", tone: "warning" },
  refunded: { label: "Refunded", tone: "info" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

const TYPE_LABELS: Record<DonationType, string> = {
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
        {TYPE_LABELS[d.type]}
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
      <Badge tone={STATUS_DISPLAY[d.status].tone}>
        {STATUS_DISPLAY[d.status].label}
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
  const [discordIdInput, setDiscordIdInput] = useState("");
  const [statusFilter, setStatusFilter] = useState<DonationStatus | "all">(
    "all",
  );
  const [typeFilter, setTypeFilter] = useState<DonationType | "all">("all");
  const debouncedDiscordId = useDebouncedValue(discordIdInput);

  const statsQuery = useQuery(trpc.owner.donations.stats.queryOptions());
  const subStatsQuery = useQuery(
    trpc.owner.donations.subscriptionStats.queryOptions(),
  );
  const donations = usePagedQuery(
    {
      discordId: debouncedDiscordId || undefined,
      status: statusFilter !== "all" ? statusFilter : undefined,
      type: typeFilter !== "all" ? typeFilter : undefined,
    },
    (input) => trpc.owner.donations.list.queryOptions(input),
  );

  const stats = statsQuery.data;

  return (
    <AdminPage
      trail={[
        { label: "Home", href: "/" },
        { label: "Owner" },
        { label: "Donations" },
      ]}
    >
      <AdminPageTitle title="Donations" />
      {statsQuery.isLoading ? (
        <LoadingState text="Loading statistics..." className="flex-none py-8" />
      ) : statsQuery.isError ? (
        <ErrorState
          message={`Failed to load donation statistics: ${statsQuery.error.message}`}
          onRetry={() => statsQuery.refetch()}
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

      {subStatsQuery.isError ? (
        <ErrorState
          message={`Failed to load subscription statistics: ${subStatsQuery.error.message}`}
          onRetry={() => subStatsQuery.refetch()}
          className="flex-none py-8"
        />
      ) : subStatsQuery.data ? (
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
      ) : null}

      <FilterBar
        search={discordIdInput}
        onSearchChange={setDiscordIdInput}
        placeholder="Search by Discord ID..."
        activeCount={
          (discordIdInput ? 1 : 0) +
          (statusFilter !== "all" ? 1 : 0) +
          (typeFilter !== "all" ? 1 : 0)
        }
      >
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as DonationStatus | "all")}
        >
          <SelectTrigger className="min-w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {DONATION_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {STATUS_DISPLAY[status].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={typeFilter}
          onValueChange={(v) => setTypeFilter(v as DonationType | "all")}
        >
          <SelectTrigger className="min-w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {Object.entries(TYPE_LABELS).map(([type, label]) => (
              <SelectItem key={type} value={type}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterBar>

      <TableCard
        title="Donations"
        paged={donations}
        empty={{ icon: Heart, message: "No donations found" }}
        itemLabel="donation"
        columns={DONATION_COLUMNS}
        rowKey={(d) => d.id}
      />
    </AdminPage>
  );
}
