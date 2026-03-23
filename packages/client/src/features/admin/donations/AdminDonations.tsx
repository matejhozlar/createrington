import { useCallback, useState } from "react";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Heart, Users, Euro, Search, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc, type RouterOutput } from "@/lib/trpc";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { Loading } from "@/components/loading-spinner";

type Donation = RouterOutput["admin"]["donations"]["list"]["donations"][number];
type DonationStatus = "pending" | "completed" | "refunded" | "cancelled";
type DonationType = "one_time" | "monthly";

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
// Main component
// =============================================================================

export function AdminDonations() {
  const [page, setPage] = useState(0);
  const [discordIdInput, setDiscordIdInput] = useState("");
  const [statusFilter, setStatusFilter] = useState<DonationStatus | "all">(
    "all",
  );
  const [typeFilter, setTypeFilter] = useState<DonationType | "all">("all");
  const debouncedDiscordId = useDebouncedValue(discordIdInput, 1000);

  const statsQuery = trpc.admin.donations.stats.useQuery();
  const listQuery = trpc.admin.donations.list.useQuery({
    page,
    limit: 20,
    discordId: debouncedDiscordId || undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
  });

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
  const error = listQuery.error?.message ?? null;

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  const getPaginationItems = useCallback(() => {
    const items: (number | "ellipsis")[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      return Array.from({ length: totalPages }, (_, i) => i);
    }

    items.push(0);

    if (page <= 2) {
      items.push(1, 2, 3);
      items.push("ellipsis");
      items.push(totalPages - 1);
    } else if (page >= totalPages - 3) {
      items.push("ellipsis");
      items.push(
        totalPages - 4,
        totalPages - 3,
        totalPages - 2,
        totalPages - 1,
      );
    } else {
      items.push("ellipsis");
      items.push(page - 1, page, page + 1);
      items.push("ellipsis");
      items.push(totalPages - 1);
    }

    return items;
  }, [page, totalPages]);

  return (
    <div className="flex flex-1 flex-col gap-4">
      {/* Header */}
      <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border bg-sidebar px-4">
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
      </header>

      <div className="flex flex-1 flex-col gap-4 px-4 pb-4">
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

        {/* Filters */}
        <Card className="gap-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Filter className="size-4 text-muted-foreground" />
              Filters
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

          {listQuery.isLoading ? (
            <CardContent className="flex flex-1 items-center justify-center py-12">
              <Loading size="medium" text="Loading donations..." />
            </CardContent>
          ) : error ? (
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
          ) : donations.length === 0 ? (
            <CardContent className="flex flex-1 items-center justify-center py-12">
              <div className="text-center">
                <Heart className="mx-auto size-12 text-muted-foreground" />
                <p className="mt-2 text-muted-foreground">No donations found</p>
              </div>
            </CardContent>
          ) : (
            <>
              <CardContent className="px-0">
                <Table>
                  <TableHeader className="bg-sidebar-accent/50">
                    <TableRow>
                      <TableHead className="px-4">ID</TableHead>
                      <TableHead className="px-4">Discord</TableHead>
                      <TableHead className="px-4">Type</TableHead>
                      <TableHead className="px-4">Amount</TableHead>
                      <TableHead className="px-4">Status</TableHead>
                      <TableHead className="px-4">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {donations.map((d: Donation) => (
                      <TableRow key={d.id}>
                        <TableCell className="px-4 font-mono text-sm">
                          {d.id}
                        </TableCell>
                        <TableCell className="px-4 font-mono text-xs text-muted-foreground">
                          {d.playerDiscordId}
                        </TableCell>
                        <TableCell className="px-4">
                          <Badge variant="outline" className="text-xs">
                            {TYPE_LABELS[d.type] ?? d.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-4 font-semibold">
                          {formatAmount(d.amountCents, d.currency)}
                        </TableCell>
                        <TableCell className="px-4">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize",
                              STATUS_STYLES[d.status] ?? STATUS_STYLES.pending,
                            )}
                          >
                            {d.status}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 text-muted-foreground text-sm">
                          {formatDate(d.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>

              <CardFooter className="flex-col gap-3 border-t sm:flex-row sm:flex-wrap sm:items-center">
                <p className="text-sm text-muted-foreground">
                  Showing {page * 20 + 1}-{Math.min((page + 1) * 20, total)} of{" "}
                  {total} donations
                </p>

                <PaginationContent className="justify-baseline sm:ml-auto sm:justify-end">
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (page > 0) handlePageChange(page - 1);
                      }}
                      className={cn(
                        page === 0 && "pointer-events-none opacity-50",
                      )}
                    />
                  </PaginationItem>

                  {getPaginationItems().map((item, index) => (
                    <PaginationItem
                      key={item === "ellipsis" ? `ellipsis-${index}` : item}
                    >
                      {item === "ellipsis" ? (
                        <PaginationEllipsis />
                      ) : (
                        <PaginationLink
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            handlePageChange(item);
                          }}
                          isActive={page === item}
                        >
                          {item + 1}
                        </PaginationLink>
                      )}
                    </PaginationItem>
                  ))}

                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (page < totalPages - 1) handlePageChange(page + 1);
                      }}
                      className={cn(
                        page >= totalPages - 1 &&
                          "pointer-events-none opacity-50",
                      )}
                    />
                  </PaginationItem>
                </PaginationContent>
              </CardFooter>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
