import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loading } from "@/components/loading-spinner";
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
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import {
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { useAdminPlayers } from "@/contexts/admin";
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
  Search,
  Filter,
  Users,
  TrendingUp,
  Coins,
  UserPlus,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  Ban,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PlayerApiData } from "@createrington/shared/db";
import { MinecraftAvatar } from "@/components/minecraft-avatar";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { trpc } from "@/lib/trpc";

// Extended player type with strike and ban counts
interface PlayerWithCounts extends PlayerApiData {
  activeStrikeCount?: number;
  activeBanCount?: number;
}

// Sort field type
type SortField = "minecraftUsername" | "lastSeen" | "createdAt";

// Violation filter type
type ViolationFilter = "all" | "strikes" | "bans" | "any";

export function AdminPlayers() {
  const { isPlayerOnline, getPlayerServerId, getServerName } =
    useAdminPlayers();

  const toast = useToastActions();

  // Pagination state
  const [page, setPage] = useState(0);
  const [limit] = useState(20);

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [onlineFilter, setOnlineFilter] = useState<boolean | undefined>(
    undefined,
  );
  const [violationFilter, setViolationFilter] =
    useState<ViolationFilter>("all");

  // Sorting state
  const [orderBy, setOrderBy] = useState<SortField>("lastSeen");
  const [orderDirection, setOrderDirection] = useState<"asc" | "desc">("desc");

  const debouncedSearch = useDebouncedValue(searchQuery, 1000);

  // tRPC queries
  const statsQuery = trpc.admin.players.players.stats.useQuery();

  const playersQuery = trpc.admin.players.players.list.useQuery({
    page,
    limit,
    orderBy,
    orderDirection,
    minecraftUsername: debouncedSearch.trim() || undefined,
    online: onlineFilter,
    hasStrikes: violationFilter === "strikes" ? true : undefined,
    hasBans: violationFilter === "bans" ? true : undefined,
    hasViolations: violationFilter === "any" ? true : undefined,
    includeStrikeCounts: true,
    includeBanCounts: true,
  });

  const stats = statsQuery.data;
  const statsLoading = statsQuery.isLoading;
  const players = (playersQuery.data?.players ?? []) as PlayerWithCounts[];
  const total = playersQuery.data?.pagination.total ?? 0;
  const totalPages = playersQuery.data?.pagination.totalPages ?? 0;
  const loading = playersQuery.isLoading;
  const error = playersQuery.error?.message ?? null;

  /**
   * Handle search
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
   * Toggle online filter
   */
  const toggleOnlineFilter = useCallback(() => {
    setOnlineFilter((prev) => {
      if (prev === undefined) return true;
      if (prev === true) return false;
      return undefined;
    });
    setPage(0);
  }, []);

  /**
   * Cycle through violation filters
   */
  const cycleViolationFilter = useCallback(() => {
    setViolationFilter((prev) => {
      if (prev === "all") return "any";
      if (prev === "any") return "strikes";
      if (prev === "strikes") return "bans";
      return "all";
    });
    setPage(0);
  }, []);

  /**
   * Handle column sort
   */
  const handleSort = useCallback(
    (field: SortField) => {
      if (orderBy === field) {
        // Toggle sort order if same field
        setOrderDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      } else {
        // Set new field with default desc order
        setOrderBy(field);
        setOrderDirection("asc");
      }
      setPage(0); // Reset to first page
    },
    [orderBy],
  );

  /**
   * Copy Discord ID to clipboard
   */
  const handleCopyDiscordId = useCallback(
    async (discordId: string) => {
      try {
        await navigator.clipboard.writeText(discordId);
        toast.info("Discord ID copied to clipboard");
      } catch (err) {
        console.error("Failed to copy Discord ID:", err);
        toast.error("Failed to copy Discord ID");
      }
    },
    [toast],
  );

  /**
   * Render sort icon for column header
   */
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

  /**
   * Generate pagination items with ellipsis
   */
  const getPaginationItems = useCallback(() => {
    const items: (number | "ellipsis")[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      // Show all pages if total is less than max visible
      return Array.from({ length: totalPages }, (_, i) => i);
    }

    // Always show first page
    items.push(0);

    if (page <= 2) {
      // Near start: show first few pages
      items.push(1, 2, 3);
      items.push("ellipsis");
      items.push(totalPages - 1);
    } else if (page >= totalPages - 3) {
      // Near end: show last few pages
      items.push("ellipsis");
      items.push(
        totalPages - 4,
        totalPages - 3,
        totalPages - 2,
        totalPages - 1,
      );
    } else {
      // Middle: show current page and neighbors
      items.push("ellipsis");
      items.push(page - 1, page, page + 1);
      items.push("ellipsis");
      items.push(totalPages - 1);
    }

    return items;
  }, [page, totalPages]);

  /**
   * Get badge info based on strikes and bans
   * Returns: { count: number, color: 'yellow' | 'red', hasIssues: boolean }
   */
  const getPlayerBadgeInfo = useCallback((player: PlayerWithCounts) => {
    const strikeCount = player.activeStrikeCount ?? 0;
    const banCount = player.activeBanCount ?? 0;
    const totalCount = strikeCount + banCount;

    if (totalCount === 0) {
      return { count: 0, color: null, hasIssues: false };
    }

    // If player has any bans (with or without strikes), show red
    if (banCount > 0) {
      return { count: totalCount, color: "red" as const, hasIssues: true };
    }

    // If player only has strikes, show yellow
    return { count: totalCount, color: "yellow" as const, hasIssues: true };
  }, []);

  /**
   * Get violation filter button content
   */
  const getViolationFilterContent = useCallback(() => {
    switch (violationFilter) {
      case "all":
        return {
          icon: <Filter className="size-4" />,
          text: "All Players",
          variant: "outline" as const,
        };
      case "any":
        return {
          icon: <ShieldAlert className="size-4" />,
          text: "Any Violations",
          variant: "destructive" as const,
        };
      case "strikes":
        return {
          icon: <AlertTriangle className="size-4" />,
          text: "With Strikes",
          variant: "default" as const,
        };
      case "bans":
        return {
          icon: <Ban className="size-4" />,
          text: "With Bans",
          variant: "destructive" as const,
        };
    }
  }, [violationFilter]);

  const navigate = useNavigate();
  const violationContent = getViolationFilterContent();

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
              <BreadcrumbPage>Players</BreadcrumbPage>
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
            {/* Total Players */}
            <Card>
              <CardContent className="flex items-start justify-between">
                <div>
                  <CardDescription>Total Players</CardDescription>
                  <CardTitle className="text-2xl">{stats.total}</CardTitle>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {stats.online} currently online
                  </p>
                </div>
                <div className="flex size-12 items-center justify-center rounded-full bg-sidebar-primary/10">
                  <Users className="size-6 text-sidebar-primary" />
                </div>
              </CardContent>
            </Card>

            {/* New This Week */}
            <Card>
              <CardContent className="flex items-start justify-between">
                <div>
                  <CardDescription>New This Week</CardDescription>
                  <CardTitle className="text-2xl">
                    {stats.registered.thisWeek}
                  </CardTitle>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {stats.registered.today} today
                  </p>
                </div>
                <div className="flex size-12 items-center justify-center rounded-full bg-chart-2/10">
                  <UserPlus className="size-6 text-chart-2" />
                </div>
              </CardContent>
            </Card>

            {/* Total Balance */}
            <Card>
              <CardContent className="flex items-start justify-between">
                <div>
                  <CardDescription>Total Balance</CardDescription>
                  <CardTitle className="text-2xl">
                    ${parseFloat(stats.balance.total).toLocaleString()}
                  </CardTitle>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Avg: ${parseFloat(stats.balance.average).toFixed(2)}
                  </p>
                </div>
                <div className="flex size-12 items-center justify-center rounded-full bg-chart-3/10">
                  <Coins className="size-6 text-chart-3" />
                </div>
              </CardContent>
            </Card>

            {/* Growth Rate */}
            <Card>
              <CardContent className="flex items-start justify-between">
                <div>
                  <CardDescription>Monthly Growth</CardDescription>
                  <CardTitle className="text-2xl">
                    {stats.registered.thisMonth}
                  </CardTitle>
                  <p className="mt-2 text-xs text-muted-foreground">
                    New registrations
                  </p>
                </div>
                <div className="flex size-12 items-center justify-center rounded-full bg-chart-4/10">
                  <TrendingUp className="size-6 text-chart-4" />
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
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearch} className="flex flex-wrap gap-2">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search by username..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(0);
                  }}
                  className="pl-9"
                />
              </div>

              <Button
                type="button"
                variant={onlineFilter === undefined ? "outline" : "default"}
                onClick={toggleOnlineFilter}
                className="min-w-[85px]"
              >
                {onlineFilter === undefined
                  ? "All"
                  : onlineFilter
                    ? "Online"
                    : "Offline"}
              </Button>

              <Button
                type="button"
                variant={violationContent.variant}
                onClick={cycleViolationFilter}
                className="min-w-[140px] gap-2"
              >
                {violationContent.icon}
                {violationContent.text}
              </Button>

              <Button type="submit" className="min-w-[85px]">
                Search
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Players Table */}
        <Card className="gap-0">
          <CardHeader className="border-b gap-0">
            <CardTitle>Players ({total.toLocaleString()})</CardTitle>
          </CardHeader>

          {loading ? (
            <CardContent className="flex flex-1 items-center justify-center py-12">
              <Loading size="medium" text="Loading players..." />
            </CardContent>
          ) : error ? (
            <CardContent className="flex flex-1 items-center justify-center py-12">
              <div className="text-center">
                <p className="text-destructive">{error}</p>
                <Button
                  onClick={() => playersQuery.refetch()}
                  className="mt-4"
                  variant="outline"
                >
                  Try Again
                </Button>
              </div>
            </CardContent>
          ) : players.length === 0 ? (
            <CardContent className="flex flex-1 items-center justify-center py-12">
              <div className="text-center">
                <Users className="mx-auto size-12 text-muted-foreground" />
                <p className="mt-2 text-muted-foreground">No players found</p>
                {violationFilter !== "all" && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Try changing the violation filter
                  </p>
                )}
              </div>
            </CardContent>
          ) : (
            <>
              {/* Table */}
              <CardContent className="px-0">
                <Table>
                  <TableHeader className="bg-sidebar-accent/50">
                    <TableRow>
                      <TableHead className="px-4">
                        <button
                          type="button"
                          onClick={() => handleSort("minecraftUsername")}
                          className="inline-flex items-center gap-1 text-sm font-medium"
                        >
                          Player
                          {renderSortIcon("minecraftUsername")}
                        </button>
                      </TableHead>
                      <TableHead className="px-4">Discord ID</TableHead>
                      <TableHead className="px-4">Status</TableHead>
                      <TableHead className="px-4">Server</TableHead>
                      <TableHead className="px-4">
                        <button
                          type="button"
                          onClick={() => handleSort("lastSeen")}
                          className="inline-flex items-center gap-1 text-sm font-medium"
                        >
                          Last Seen
                          {renderSortIcon("lastSeen")}
                        </button>
                      </TableHead>
                      <TableHead className="px-4 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {players.map((player) => {
                      // Get real-time online status from socket data
                      const isOnline = isPlayerOnline(player.minecraftUuid);
                      const currentServerId = getPlayerServerId(
                        player.minecraftUuid,
                      );
                      const serverName = currentServerId
                        ? getServerName(currentServerId)
                        : null;

                      const badgeInfo = getPlayerBadgeInfo(player);

                      return (
                        <TableRow
                          key={player.minecraftUuid}
                          className={cn(
                            badgeInfo.hasIssues &&
                              badgeInfo.color === "yellow" &&
                              "bg-yellow-500/5",
                            badgeInfo.hasIssues &&
                              badgeInfo.color === "red" &&
                              "bg-destructive/5",
                          )}
                        >
                          <TableCell className="px-4">
                            <div className="flex items-center gap-3">
                              <div className="relative">
                                <MinecraftAvatar
                                  uuid={player.minecraftUuid}
                                  username={player.minecraftUsername}
                                />
                                {badgeInfo.hasIssues && (
                                  <div
                                    className={cn(
                                      "absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full text-[10px] font-bold text-white ring-2 ring-background",
                                      badgeInfo.color === "yellow" &&
                                        "bg-yellow-500",
                                      badgeInfo.color === "red" &&
                                        "bg-destructive",
                                    )}
                                  >
                                    {badgeInfo.count}
                                  </div>
                                )}
                              </div>
                              <div>
                                <p className="font-medium">
                                  {player.minecraftUsername}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {player.minecraftUuid.slice(0, 8)}...
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="px-4">
                            <button
                              onClick={() =>
                                handleCopyDiscordId(player.discordId)
                              }
                              className="text-sm font-mono text-muted-foreground hover:text-foreground transition-colors"
                              title="Click to copy"
                              type="button"
                            >
                              {player.discordId}
                            </button>
                          </TableCell>
                          <TableCell className="px-4">
                            <Badge
                              variant={isOnline ? "default" : "outline"}
                              className={cn(
                                isOnline &&
                                  "bg-green-500/20 text-green-500 hover:bg-green-500/30",
                              )}
                            >
                              {isOnline ? "Online" : "Offline"}
                            </Badge>
                          </TableCell>
                          <TableCell className="px-4">
                            {isOnline && serverName ? (
                              <p className="text-sm text-foreground">
                                {serverName}
                              </p>
                            ) : (
                              <p className="text-sm text-muted-foreground">—</p>
                            )}
                          </TableCell>
                          <TableCell className="px-4">
                            <p className="text-sm text-muted-foreground">
                              {new Date(player.lastSeen).toLocaleDateString()}
                            </p>
                          </TableCell>
                          <TableCell className="px-4 text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                navigate(
                                  `/admin/players/${player.minecraftUuid}`,
                                )
                              }
                              className="cursor-pointer"
                            >
                              View
                            </Button>
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
                  {Math.min((page + 1) * limit, total)} of {total} players
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
