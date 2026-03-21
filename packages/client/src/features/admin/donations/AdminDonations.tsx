import { useState } from "react";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChevronLeft,
  ChevronRight,
  Heart,
  Users,
  Euro,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc, type RouterOutput } from "@/lib/trpc";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

type Donation = RouterOutput["admin"]["donations"]["list"]["donations"][number];

// =============================================================================
// Static data
// =============================================================================

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

// =============================================================================
// Helpers
// =============================================================================

function formatAmount(cents: number, currency: string) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// =============================================================================
// Stat card
// =============================================================================

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border bg-card p-4">
      <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
        <Icon className="size-5 text-primary" />
      </div>
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold">{value}</p>
      </div>
    </div>
  );
}

// =============================================================================
// Main component
// =============================================================================

export function AdminDonations() {
  const [page, setPage] = useState(0);
  const [discordIdInput, setDiscordIdInput] = useState("");
  const debouncedDiscordId = useDebouncedValue(discordIdInput, 600);

  const statsQuery = trpc.admin.donations.stats.useQuery();
  const listQuery = trpc.admin.donations.list.useQuery({
    page,
    limit: 20,
    discordId: debouncedDiscordId || undefined,
  });

  const stats = statsQuery.data;
  const donations = listQuery.data?.donations ?? [];
  const pagination = listQuery.data?.pagination;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/admin/dashboard">Admin</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Donations</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div>
        <h1 className="text-2xl font-semibold">Donations</h1>
        <p className="text-sm text-muted-foreground">
          Overview of all supporter donations
        </p>
      </div>

      <Separator />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={Euro}
          label="Total raised"
          value={
            stats
              ? formatAmount(stats.totalRaisedCents, "EUR")
              : "—"
          }
        />
        <StatCard
          icon={Users}
          label="Unique donors"
          value={stats?.donorCount ?? "—"}
        />
        <StatCard
          icon={Heart}
          label="Total donations"
          value={stats?.donationCount ?? "—"}
        />
      </div>

      <Separator />

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Filter by Discord ID..."
            value={discordIdInput}
            onChange={(e) => {
              setDiscordIdInput(e.target.value);
              setPage(0);
            }}
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Discord</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Role</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {listQuery.isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                  Loading...
                </TableCell>
              </TableRow>
            ) : donations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                  No donations found
                </TableCell>
              </TableRow>
            ) : (
              donations.map((d: Donation) => (
                <TableRow key={d.id}>
                  <TableCell className="font-mono text-sm">{d.id}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {d.playerDiscordId}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {TYPE_LABELS[d.type] ?? d.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-semibold">
                    {formatAmount(d.amountCents, d.currency)}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize",
                        STATUS_STYLES[d.status] ?? STATUS_STYLES.pending,
                      )}
                    >
                      {d.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDate(d.createdAt)}
                  </TableCell>
                  <TableCell>
                    {d.supporterRoleGranted ? (
                      <Heart className="size-4 text-primary" />
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Page {page + 1}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              <ChevronLeft className="size-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={!pagination.hasNextPage}
            >
              Next
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
