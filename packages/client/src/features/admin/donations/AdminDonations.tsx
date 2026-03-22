import { useState } from "react";
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
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Heart, Users, Euro, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc, type RouterOutput } from "@/lib/trpc";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { Loading } from "@/components/loading-spinner";

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
                  <CardTitle className="text-2xl">
                    {stats.donorCount}
                  </CardTitle>
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

        {/* Donations Table */}
        <Card className="gap-0">
          <CardHeader className="border-b gap-0">
            <CardTitle className="flex items-center justify-between">
              Donations{pagination?.total != null ? ` (${pagination.total})` : ""}
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  className="pl-9 text-sm font-normal"
                  placeholder="Filter by Discord ID..."
                  value={discordIdInput}
                  onChange={(e) => {
                    setDiscordIdInput(e.target.value);
                    setPage(0);
                  }}
                />
              </div>
            </CardTitle>
          </CardHeader>

          {listQuery.isLoading ? (
            <CardContent className="flex flex-1 items-center justify-center py-12">
              <Loading size="medium" text="Loading donations..." />
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

              {pagination && (
                <CardFooter className="flex items-center justify-between border-t">
                  <span className="text-sm text-muted-foreground">
                    Showing {page * pagination.limit + 1}–{Math.min((page + 1) * pagination.limit, pagination.total)} of {pagination.total}
                  </span>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          if (page > 0) setPage((p) => p - 1);
                        }}
                        className={cn(
                          page === 0 && "pointer-events-none opacity-50",
                        )}
                      />
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          if (pagination.hasNextPage) setPage((p) => p + 1);
                        }}
                        className={cn(
                          !pagination.hasNextPage &&
                            "pointer-events-none opacity-50",
                        )}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </CardFooter>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
