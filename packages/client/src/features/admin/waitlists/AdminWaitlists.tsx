import { useCallback, useEffect, useState } from "react";
import { Loading } from "@/components/Loading";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
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
import type {
  WaitlistEntryApiData,
  WaitlistStatus,
} from "@createrington/shared/db";
import type {
  GetAdminWaitlistEntriesQuery,
  GetAdminWaitlistEntriesResponse,
  GetAdminWaitlistStatsResponse,
  AdminWaitlistStats,
} from "@createrington/shared/api";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { InviteWaitlistModal } from "./components/modals/InviteWaitlistModal";
import { DeleteWaitlistModal } from "./components/modals/DeleteWaitlistModal";

type WaitlistEntryWithDates = Omit<
  WaitlistEntryApiData,
  "submittedAt" | "acceptedAt"
> & {
  submittedAt: string;
  acceptedAt: string | null;
};

type SortField = "submittedAt" | "acceptedAt" | "email" | "discordName";
type StatusFilter = "all" | WaitlistStatus;

export function AdminWaitlists() {
  const toast = useToastActions();

  // Stats state
  const [stats, setStats] = useState<AdminWaitlistStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Waitlist entries state
  const [entries, setEntries] = useState<WaitlistEntryWithDates[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [page, setPage] = useState(0);
  const [limit] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [verifiedFilter, setVerifiedFilter] = useState<boolean | undefined>(
    undefined,
  );

  // Sorting state
  const [sortBy, setSortBy] = useState<SortField>("submittedAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Modal state
  const [inviteModal, setInviteModal] = useState<{
    open: boolean;
    entryId: number | null;
  }>({ open: false, entryId: null });
  const [deleteModal, setDeleteModal] = useState<{
    open: boolean;
    entry: WaitlistEntryWithDates | null;
  }>({ open: false, entry: null });

  const debouncedSearch = useDebouncedValue(searchQuery, 1000);

  /**
   * Fetch waitlist statistics
   */
  const fetchStats = useCallback(async () => {
    try {
      setStatsLoading(true);

      const token = localStorage.getItem("auth_token");
      if (!token) {
        throw new Error("No authentication token");
      }

      const response = await fetch("/api/admin/waitlists/stats", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: GetAdminWaitlistStatsResponse = await response.json();

      if (data.success) {
        setStats(data.data);
      }
    } catch (err) {
      console.error("Failed to fetch waitlist stats:", err);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  /**
   * Load waitlist entries with current filters
   */
  const loadEntries = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem("auth_token");
      if (!token) {
        throw new Error("No authentication token");
      }

      const query: GetAdminWaitlistEntriesQuery = {
        page: page.toString(),
        limit: limit.toString(),
        sortBy,
        sortOrder,
      };

      if (debouncedSearch.trim()) {
        // Search in both email and discord name
        query.email = debouncedSearch.trim();
        query.discordName = debouncedSearch.trim();
      }

      if (statusFilter !== "all") {
        query.status = statusFilter;
      }

      if (verifiedFilter !== undefined) {
        query.verified = verifiedFilter ? "true" : "false";
      }

      const params = new URLSearchParams();
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined) {
          params.append(key, String(value));
        }
      });

      const url = `/api/admin/waitlists${params.toString() ? `?${params.toString()}` : ""}`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: GetAdminWaitlistEntriesResponse = await response.json();

      if (data.success) {
        setEntries(data.data.entries as WaitlistEntryWithDates[]);
        setTotal(data.data.pagination.total);
        setTotalPages(data.data.pagination.totalPages);
      }
    } catch (err) {
      console.error("Failed to load waitlist entries:", err);
      setError("Failed to load waitlist entries");
    } finally {
      setLoading(false);
    }
  }, [
    debouncedSearch,
    page,
    limit,
    statusFilter,
    verifiedFilter,
    sortBy,
    sortOrder,
  ]);

  // Load stats and entries on mount
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [debouncedSearch, statusFilter, verifiedFilter, sortBy, sortOrder]);

  /**
   * Handle search form submission
   */
  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
  }, []);

  /**
   * Handle page change
   */
  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  /**
   * Toggle verified filter
   */
  const toggleVerifiedFilter = useCallback(() => {
    setVerifiedFilter((prev) => {
      if (prev === undefined) return true;
      if (prev === true) return false;
      return undefined;
    });
    setPage(0);
  }, []);

  /**
   * Handle column sort
   */
  const handleSort = useCallback(
    (field: SortField) => {
      if (sortBy === field) {
        setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
      } else {
        setSortBy(field);
        setSortOrder("desc");
      }
      setPage(0);
    },
    [sortBy],
  );

  /**
   * Copy email to clipboard
   */
  const handleCopyEmail = useCallback(
    async (email: string) => {
      try {
        await navigator.clipboard.writeText(email);
        toast.info("Email copied to clipboard");
      } catch (err) {
        console.error("Failed to copy email:", err);
        toast.error("Failed to copy email");
      }
    },
    [toast],
  );

  /**
   * Open invite modal
   */
  const handleInvite = useCallback((entryId: number) => {
    setInviteModal({ open: true, entryId });
  }, []);

  /**
   * Open delete modal
   */
  const handleDelete = useCallback((entry: WaitlistEntryWithDates) => {
    setDeleteModal({ open: true, entry });
  }, []);

  /**
   * Handle successful invite
   */
  const handleInviteSuccess = useCallback(() => {
    setInviteModal({ open: false, entryId: null });
    loadEntries();
    fetchStats();
  }, [loadEntries, fetchStats]);

  /**
   * Handle successful deletion
   */
  const handleDeleteSuccess = useCallback(() => {
    setDeleteModal({ open: false, entry: null });
    loadEntries();
    fetchStats();
  }, [loadEntries, fetchStats]);

  /**
   * Render sort icon for column header
   */
  const renderSortIcon = useCallback(
    (field: SortField) => {
      if (sortBy !== field) {
        return <ArrowUpDown className="ml-1 size-3.5 opacity-50" />;
      }
      return sortOrder === "asc" ? (
        <ArrowUp className="ml-1 size-3.5" />
      ) : (
        <ArrowDown className="ml-1 size-3.5" />
      );
    },
    [sortBy, sortOrder],
  );

  /**
   * Generate pagination items with ellipsis
   */
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

  /**
   * Get status badge variant and custom classes
   */
  const getStatusBadgeStyle = useCallback((status: string) => {
    switch (status.toLowerCase()) {
      case "accepted":
        return {
          variant: "outline" as const,
          className: "border-success bg-success/10 text-success",
        };
      case "rejected":
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
      <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border bg-sidebar px-4">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/admin/dashboard">Admin</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Waitlist</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      <div className="flex flex-1 flex-col gap-4 px-4 pb-4">
        {/* Stats Cards */}
        {statsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loading size="medium" text="Loading statistics..." />
          </div>
        ) : stats ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Total Entries */}
            <div className="rounded-lg border border-border bg-card p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Entries</p>
                  <p className="text-2xl font-semibold">{stats.total}</p>
                </div>
                <div className="flex size-12 items-center justify-center rounded-full bg-sidebar-primary/10">
                  <Users className="size-6 text-sidebar-primary" />
                </div>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                {stats.pending} pending approval
              </div>
            </div>

            {/* Accepted */}
            <div className="rounded-lg border border-border bg-card p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Accepted</p>
                  <p className="text-2xl font-semibold">{stats.accepted}</p>
                </div>
                <div className="flex size-12 items-center justify-center rounded-full bg-chart-2/10">
                  <UserCheck className="size-6 text-chart-2" />
                </div>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                {stats.joinedMinecraft} joined Minecraft
              </div>
            </div>

            {/* New This Week */}
            <div className="rounded-lg border border-border bg-card p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">New This Week</p>
                  <p className="text-2xl font-semibold">
                    {stats.submitted.thisWeek}
                  </p>
                </div>
                <div className="flex size-12 items-center justify-center rounded-full bg-chart-3/10">
                  <UserPlus className="size-6 text-chart-3" />
                </div>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                {stats.submitted.today} today
              </div>
            </div>

            {/* Verified */}
            <div className="rounded-lg border border-border bg-card p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Verified</p>
                  <p className="text-2xl font-semibold">{stats.verified}</p>
                </div>
                <div className="flex size-12 items-center justify-center rounded-full bg-chart-4/10">
                  <Clock className="size-6 text-chart-4" />
                </div>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                {stats.registered} registered
              </div>
            </div>
          </div>
        ) : null}

        {/* Filters & Search */}
        <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <Filter className="size-4 text-muted-foreground" />
            <h3 className="font-semibold">Filters</h3>
          </div>

          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search by email or Discord name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant={statusFilter === "all" ? "default" : "outline"}
                size="default"
                onClick={() => {
                  setStatusFilter("all");
                  setPage(0);
                }}
                className="min-w-[85px] cursor-pointer"
              >
                All
              </Button>
              <Button
                type="button"
                variant={statusFilter === "pending" ? "default" : "outline"}
                size="default"
                onClick={() => {
                  setStatusFilter("pending");
                  setPage(0);
                }}
                className="min-w-[85px] cursor-pointer"
              >
                Pending
              </Button>
              <Button
                type="button"
                variant={statusFilter === "accepted" ? "default" : "outline"}
                size="default"
                onClick={() => {
                  setStatusFilter("accepted");
                  setPage(0);
                }}
                className="min-w-[90px] cursor-pointer"
              >
                Accepted
              </Button>
            </div>

            <Button
              type="button"
              variant={verifiedFilter === undefined ? "outline" : "default"}
              size="default"
              onClick={toggleVerifiedFilter}
              className="min-w-[90px] cursor-pointer"
            >
              {verifiedFilter === undefined
                ? "All"
                : verifiedFilter
                  ? "Verified"
                  : "Unverified"}
            </Button>

            <Button type="submit" className="min-w-[85px] cursor-pointer">
              Search
            </Button>
          </form>
        </div>

        {/* Waitlist Table */}
        <div className="flex flex-1 flex-col gap-4 rounded-lg border border-border bg-card">
          <div className="border-b border-border p-4">
            <h2 className="font-semibold">
              Waitlist Entries ({total.toLocaleString()})
            </h2>
          </div>

          {loading ? (
            <div className="flex flex-1 items-center justify-center py-12">
              <Loading size="medium" text="Loading waitlist entries..." />
            </div>
          ) : error ? (
            <div className="flex flex-1 items-center justify-center py-12">
              <div className="text-center">
                <p className="text-destructive">{error}</p>
                <Button
                  onClick={loadEntries}
                  className="mt-4 cursor-pointer"
                  variant="outline"
                >
                  Try Again
                </Button>
              </div>
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-1 items-center justify-center py-12">
              <div className="text-center">
                <Users className="mx-auto size-12 text-muted-foreground" />
                <p className="mt-2 text-muted-foreground">
                  No waitlist entries found
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-border bg-sidebar-accent/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium">
                        ID
                      </th>
                      <th
                        className="cursor-pointer select-none px-4 py-3 text-left text-sm font-medium transition-colors hover:bg-sidebar-accent/80"
                        onClick={() => handleSort("email")}
                      >
                        <div className="flex items-center">
                          Email
                          {renderSortIcon("email")}
                        </div>
                      </th>
                      <th
                        className="cursor-pointer select-none px-4 py-3 text-left text-sm font-medium transition-colors hover:bg-sidebar-accent/80"
                        onClick={() => handleSort("discordName")}
                      >
                        <div className="flex items-center">
                          Discord Name
                          {renderSortIcon("discordName")}
                        </div>
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium">
                        Progress
                      </th>
                      <th
                        className="cursor-pointer select-none px-4 py-3 text-left text-sm font-medium transition-colors hover:bg-sidebar-accent/80"
                        onClick={() => handleSort("submittedAt")}
                      >
                        <div className="flex items-center">
                          Submitted
                          {renderSortIcon("submittedAt")}
                        </div>
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-medium">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {entries.map((entry) => {
                      const isPending = entry.status === "pending";
                      const isAccepted = entry.status === "accepted";

                      return (
                        <tr
                          key={entry.id}
                          className="transition-colors hover:bg-sidebar-accent/30"
                        >
                          <td className="px-4 py-3">
                            <p className="font-mono text-sm">#{entry.id}</p>
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => handleCopyEmail(entry.email)}
                              className="cursor-pointer text-sm transition-colors hover:text-foreground"
                              title="Click to copy"
                            >
                              <div className="flex items-center gap-2">
                                <Mail className="size-4 text-muted-foreground" />
                                <span>{entry.email}</span>
                              </div>
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium">{entry.discordName}</p>
                            {entry.discordId && (
                              <p className="text-xs text-muted-foreground">
                                ID: {entry.discordId}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3">
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
                          </td>
                          <td className="px-4 py-3">
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
                          </td>
                          <td className="px-4 py-3">
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
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-2">
                              {isPending && (
                                <Button
                                  size="sm"
                                  variant="default"
                                  className="cursor-pointer"
                                  onClick={() => handleInvite(entry.id)}
                                >
                                  Invite
                                </Button>
                              )}
                              {isAccepted && (
                                <Badge variant="default">Invited</Badge>
                              )}
                              <Button
                                size="sm"
                                variant="destructive"
                                className="cursor-pointer"
                                onClick={() => handleDelete(entry)}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center border-t border-border p-4">
                <p className="text-sm text-muted-foreground">
                  Showing {page * limit + 1}-
                  {Math.min((page + 1) * limit, total)} of {total} entries
                </p>

                <PaginationContent className="ml-auto flex-nowrap justify-end">
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (page > 0) handlePageChange(page - 1);
                      }}
                      className={cn(
                        page === 0 && "pointer-events-none opacity-50",
                        "cursor-pointer",
                      )}
                    />
                  </PaginationItem>

                  {getPaginationItems().map((item, index) => (
                    <PaginationItem key={index}>
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
                          className="cursor-pointer"
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
                        "cursor-pointer",
                      )}
                    />
                  </PaginationItem>
                </PaginationContent>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modals */}
      {inviteModal.entryId !== null && (
        <InviteWaitlistModal
          open={inviteModal.open}
          onClose={() => setInviteModal({ open: false, entryId: null })}
          entryId={inviteModal.entryId}
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
