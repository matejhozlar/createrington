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
import {
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { useToastActions } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  Search,
  Filter,
  Users,
  UserPlus,
  UserCheck,
  Clock,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Mail,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { WaitlistStatus } from "@createrington/shared/db";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { InviteWaitlistModal } from "./components/modals/InviteWaitlistModal";
import { DeleteWaitlistModal } from "./components/modals/DeleteWaitlistModal";
import { trpc, type RouterOutput } from "@/lib/trpc";

type WaitlistEntry =
  RouterOutput["admin"]["waitlists"]["list"]["entries"][number];

type SortField = "submittedAt" | "acceptedAt" | "email" | "discordName";
type StatusFilter = "all" | WaitlistStatus;

export function AdminWaitlists() {
  const toast = useToastActions();

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

  const entriesQuery = trpc.admin.waitlists.list.useQuery({
    page,
    limit,
    orderBy,
    orderDirection,
    email: debouncedSearch.trim() || undefined,
    discordName: debouncedSearch.trim() || undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
    verified: verifiedFilter,
  });

  const entries = entriesQuery.data?.entries ?? [];
  const total = entriesQuery.data?.pagination.total ?? 0;
  const totalPages = entriesQuery.data?.pagination.totalPages ?? 0;
  const loading = entriesQuery.isLoading;
  const error = entriesQuery.error?.message ?? null;

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
  }, []);

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
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

  const handleCopyEmail = useCallback(
    async (email: string) => {
      try {
        await navigator.clipboard.writeText(email);
        toast.success("Copied to clipboard");
      } catch {
        toast.error("Failed to copy to clipboard");
      }
    },
    [toast],
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

  const renderSortIcon = useCallback(
    (field: SortField) => {
      if (orderBy !== field) {
        return <ArrowUpDown className="ml-1 size-3.5 opacity-50" />;
      }
      return orderDirection === "asc" ? (
        <ArrowUp className="ml-1 size-3.5" />
      ) : (
        <ArrowDown className="ml-1 size-3.5" />
      );
    },
    [orderBy, orderDirection],
  );

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

          {loading ? (
            <CardContent className="flex flex-1 items-center justify-center py-12">
              <Loading size="medium" text="Loading waitlist entries..." />
            </CardContent>
          ) : error ? (
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
          ) : entries.length === 0 ? (
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
                <Table className="min-w-[956px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead col="id">ID</TableHead>
                      <TableHead>
                        <button
                          type="button"
                          onClick={() => handleSort("email")}
                          className="inline-flex cursor-pointer items-center gap-1 uppercase"
                        >
                          Email
                          {renderSortIcon("email")}
                        </button>
                      </TableHead>
                      <TableHead col="player">
                        <button
                          type="button"
                          onClick={() => handleSort("discordName")}
                          className="inline-flex cursor-pointer items-center gap-1 uppercase"
                        >
                          Discord Name
                          {renderSortIcon("discordName")}
                        </button>
                      </TableHead>
                      <TableHead col="status">Status</TableHead>
                      <TableHead col="status">Progress</TableHead>
                      <TableHead col="date">
                        <button
                          type="button"
                          onClick={() => handleSort("submittedAt")}
                          className="inline-flex cursor-pointer items-center gap-1 uppercase"
                        >
                          Submitted
                          {renderSortIcon("submittedAt")}
                        </button>
                      </TableHead>
                      <TableHead className="w-[156px] text-right">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((entry) => {
                      const isPending = entry.status === "pending";
                      const isAccepted = entry.status === "accepted";
                      const isAutoAccepted = entry.status === "auto_accepted";

                      return (
                        <TableRow key={entry.id}>
                          <TableCell>
                            <p className="font-mono text-sm">#{entry.id}</p>
                          </TableCell>
                          <TableCell>
                            {entry.email ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    onClick={() =>
                                      handleCopyEmail(entry.email!)
                                    }
                                    className="cursor-pointer text-sm transition-colors hover:text-foreground"
                                    type="button"
                                  >
                                    <div className="flex items-center gap-2">
                                      <Mail className="size-4 text-muted-foreground" />
                                      <span>{entry.email}</span>
                                    </div>
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>Click to copy</TooltipContent>
                              </Tooltip>
                            ) : (
                              <span className="text-sm text-muted-foreground">
                                -
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <p className="font-medium">{entry.discordName}</p>
                            {entry.discordId && (
                              <p className="text-xs text-muted-foreground">
                                ID: {entry.discordId}
                              </p>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                getStatusBadgeStyle(entry.status).variant
                              }
                              className={
                                getStatusBadgeStyle(entry.status).className
                              }
                            >
                              {entry.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {entry.joinedDiscord && (
                                <Badge
                                  variant="outline"
                                  className="border-success bg-success/10 text-success text-xs"
                                >
                                  Discord
                                </Badge>
                              )}
                              {entry.verified && (
                                <Badge
                                  variant="outline"
                                  className="border-success bg-success/10 text-success text-xs"
                                >
                                  Verified
                                </Badge>
                              )}
                              {entry.registered && (
                                <Badge
                                  variant="outline"
                                  className="border-success bg-success/10 text-success text-xs"
                                >
                                  Registered
                                </Badge>
                              )}
                              {entry.joinedMinecraft && (
                                <Badge
                                  variant="outline"
                                  className="border-success bg-success/10 text-success text-xs"
                                >
                                  In-Game
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className="text-sm text-muted-foreground">
                              {new Date(entry.submittedAt).toLocaleDateString()}
                            </p>
                            {entry.acceptedAt && (
                              <p className="text-xs text-muted-foreground">
                                Accepted:{" "}
                                {new Date(
                                  entry.acceptedAt,
                                ).toLocaleDateString()}
                              </p>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-wrap justify-end gap-2">
                              {isPending && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="default"
                                      aria-label="Send invite"
                                      onClick={() => handleInvite(entry)}
                                    >
                                      <Mail className="size-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Send invite</TooltipContent>
                                </Tooltip>
                              )}
                              {isAccepted && (
                                <Badge variant="default">Invited</Badge>
                              )}
                              {isAutoAccepted && (
                                <Badge
                                  variant="outline"
                                  className="border-chart-2 bg-chart-2/10 text-chart-2"
                                >
                                  Auto-Accepted
                                </Badge>
                              )}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    aria-label="Delete entry"
                                    onClick={() => handleDelete(entry)}
                                  >
                                    <Trash2 className="size-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Delete entry</TooltipContent>
                              </Tooltip>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>

              {/* Pagination */}
              <CardFooter className="flex-col gap-3 border-t sm:flex-row sm:flex-wrap sm:items-center">
                <p className="text-sm text-muted-foreground">
                  Showing {page * limit + 1}-
                  {Math.min((page + 1) * limit, total)} of {total} entries
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
