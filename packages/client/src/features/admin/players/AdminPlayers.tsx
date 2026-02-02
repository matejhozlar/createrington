import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loading } from "@/components/Loading";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { useAdminPlayers } from "@/contexts/admin";
import { useToastActions } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Filter,
  Users,
  TrendingUp,
  Coins,
  UserPlus,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PlayerApiData } from "@createrington/shared/db";
import type { GetAdminPlayersQuery } from "@createrington/shared/api";
import { MinecraftAvatar } from "@/components/minecraft-avatar";

// Extended player type with strike count
interface PlayerWithStrikes extends PlayerApiData {
  activeStrikeCount?: number;
}

// Sort field type
type SortField = "minecraftUsername" | "lastSeen" | "createdAt";

export function AdminPlayers() {
  const {
    stats,
    loading: statsLoading,
    fetchPlayers,
    isPlayerOnline,
    getPlayerServerId,
    getServerName,
  } = useAdminPlayers();

  const toast = useToastActions();

  // Player list state
  const [players, setPlayers] = useState<PlayerWithStrikes[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [page, setPage] = useState(0);
  const [limit] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [onlineFilter, setOnlineFilter] = useState<boolean | undefined>(
    undefined,
  );

  // Sorting state
  const [sortBy, setSortBy] = useState<SortField>("lastSeen");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  /**
   * Fetch active strike counts for players
   */
  const fetchStrikeCounts = useCallback(async (playerUuids: string[]) => {
    try {
      const token = localStorage.getItem("auth_token");
      if (!token || playerUuids.length === 0) return {};

      // Fetch strike counts for all players
      const strikeCounts: Record<string, number> = {};

      // Note: In a real implementation, you'd want a batch endpoint
      // For now, we'll fetch individually (consider adding a batch endpoint later)
      await Promise.all(
        playerUuids.map(async (uuid) => {
          try {
            const response = await fetch(
              `/api/admin/players/${uuid}/strikes?activeOnly=true`,
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              },
            );

            if (response.ok) {
              const data = await response.json();
              if (data.success && data.data.strikes) {
                strikeCounts[uuid] = data.data.strikes.length;
              }
            }
          } catch (err) {
            // Silently fail for individual strike fetches
            console.warn(`Failed to fetch strikes for ${uuid}:`, err);
          }
        }),
      );

      return strikeCounts;
    } catch (err) {
      console.error("Failed to fetch strike counts:", err);
      return {};
    }
  }, []);

  /**
   * Load players with current filters
   */
  const loadPlayers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const query: GetAdminPlayersQuery = {
        page: page.toString(),
        limit: limit.toString(),
        sortBy,
        sortOrder,
      };

      if (searchQuery) {
        query.minecraftUsername = searchQuery;
      }

      if (onlineFilter !== undefined) {
        query.online = onlineFilter ? "true" : "false";
      }

      const data = await fetchPlayers(query);

      if (data) {
        const playersData = data.data.players;

        // Fetch strike counts for all players
        const playerUuids = playersData.map((p) => p.minecraftUuid);
        const strikeCounts = await fetchStrikeCounts(playerUuids);

        // Combine player data with strike counts
        const playersWithStrikes = playersData.map((player) => ({
          ...player,
          activeStrikeCount: strikeCounts[player.minecraftUuid] || 0,
        }));

        setPlayers(playersWithStrikes);
        setTotal(data.data.pagination.total);
        setTotalPages(data.data.pagination.totalPages);
      }
    } catch (err) {
      console.error("Failed to load players:", err);
      setError("Failed to load players");
    } finally {
      setLoading(false);
    }
  }, [
    fetchPlayers,
    fetchStrikeCounts,
    page,
    limit,
    searchQuery,
    onlineFilter,
    sortBy,
    sortOrder,
  ]);

  // Load players on mount and when filters change
  useEffect(() => {
    loadPlayers();
  }, [loadPlayers]);

  /**
   * Handle search
   */
  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setPage(0); // Reset to first page
      loadPlayers();
    },
    [loadPlayers],
  );

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
   * Handle column sort
   */
  const handleSort = useCallback(
    (field: SortField) => {
      if (sortBy === field) {
        // Toggle sort order if same field
        setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
      } else {
        // Set new field with default desc order
        setSortBy(field);
        setSortOrder("desc");
      }
      setPage(0); // Reset to first page
    },
    [sortBy],
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

  const navigate = useNavigate();

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
            <div className="rounded-lg border border-border bg-card p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Players</p>
                  <p className="text-2xl font-semibold">{stats.total}</p>
                </div>
                <div className="flex size-12 items-center justify-center rounded-full bg-sidebar-primary/10">
                  <Users className="size-6 text-sidebar-primary" />
                </div>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                {stats.online} currently online
              </div>
            </div>

            {/* New This Week */}
            <div className="rounded-lg border border-border bg-card p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">New This Week</p>
                  <p className="text-2xl font-semibold">
                    {stats.registered.thisWeek}
                  </p>
                </div>
                <div className="flex size-12 items-center justify-center rounded-full bg-chart-2/10">
                  <UserPlus className="size-6 text-chart-2" />
                </div>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                {stats.registered.today} today
              </div>
            </div>

            {/* Total Balance */}
            <div className="rounded-lg border border-border bg-card p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Balance</p>
                  <p className="text-2xl font-semibold">
                    ${parseFloat(stats.balance.total).toLocaleString()}
                  </p>
                </div>
                <div className="flex size-12 items-center justify-center rounded-full bg-chart-3/10">
                  <Coins className="size-6 text-chart-3" />
                </div>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                Avg: ${parseFloat(stats.balance.average).toFixed(2)}
              </div>
            </div>

            {/* Growth Rate */}
            <div className="rounded-lg border border-border bg-card p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Monthly Growth
                  </p>
                  <p className="text-2xl font-semibold">
                    {stats.registered.thisMonth}
                  </p>
                </div>
                <div className="flex size-12 items-center justify-center rounded-full bg-chart-4/10">
                  <TrendingUp className="size-6 text-chart-4" />
                </div>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                New registrations
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
                placeholder="Search by username..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <Button
              type="button"
              variant={onlineFilter === undefined ? "outline" : "default"}
              size="default"
              onClick={toggleOnlineFilter}
              className="cursor-pointer min-w-[85px]"
            >
              {onlineFilter === undefined
                ? "All"
                : onlineFilter
                  ? "Online"
                  : "Offline"}
            </Button>

            <Button type="submit" className="cursor-pointer min-w-[85px]">
              Search
            </Button>
          </form>
        </div>

        {/* Players Table */}
        <div className="flex flex-1 flex-col gap-4 rounded-lg border border-border bg-card">
          <div className="border-b border-border p-4">
            <h2 className="font-semibold">
              Players ({total.toLocaleString()})
            </h2>
          </div>

          {loading ? (
            <div className="flex flex-1 items-center justify-center py-12">
              <Loading size="medium" text="Loading players..." />
            </div>
          ) : error ? (
            <div className="flex flex-1 items-center justify-center py-12">
              <div className="text-center">
                <p className="text-destructive">{error}</p>
                <Button
                  onClick={loadPlayers}
                  className="mt-4 cursor-pointer"
                  variant="outline"
                >
                  Try Again
                </Button>
              </div>
            </div>
          ) : players.length === 0 ? (
            <div className="flex flex-1 items-center justify-center py-12">
              <div className="text-center">
                <Users className="mx-auto size-12 text-muted-foreground" />
                <p className="mt-2 text-muted-foreground">No players found</p>
              </div>
            </div>
          ) : (
            <>
              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-border bg-sidebar-accent/50">
                    <tr>
                      <th
                        className="px-4 py-3 text-left text-sm font-medium cursor-pointer hover:bg-sidebar-accent/80 transition-colors select-none"
                        onClick={() => handleSort("minecraftUsername")}
                      >
                        <div className="flex items-center">
                          Player
                          {renderSortIcon("minecraftUsername")}
                        </div>
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium">
                        Discord ID
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium">
                        Server
                      </th>
                      <th
                        className="px-4 py-3 text-left text-sm font-medium cursor-pointer hover:bg-sidebar-accent/80 transition-colors select-none"
                        onClick={() => handleSort("lastSeen")}
                      >
                        <div className="flex items-center">
                          Last Seen
                          {renderSortIcon("lastSeen")}
                        </div>
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-medium">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {players.map((player) => {
                      // Get real-time online status from socket data
                      const isOnline = isPlayerOnline(player.minecraftUuid);
                      const currentServerId = getPlayerServerId(
                        player.minecraftUuid,
                      );
                      const serverName = currentServerId
                        ? getServerName(currentServerId)
                        : null;
                      const hasActiveStrikes =
                        (player.activeStrikeCount ?? 0) > 0;

                      return (
                        <tr
                          key={player.minecraftUuid}
                          className={cn(
                            "transition-colors hover:bg-sidebar-accent/30",
                            hasActiveStrikes && "bg-destructive/5",
                          )}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="relative">
                                <MinecraftAvatar
                                  uuid={player.minecraftUuid}
                                  username={player.minecraftUsername}
                                />
                                {hasActiveStrikes && (
                                  <div className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white ring-2 ring-background">
                                    {player.activeStrikeCount}
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
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() =>
                                handleCopyDiscordId(player.discordId)
                              }
                              className="text-sm font-mono text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                              title="Click to copy"
                            >
                              {player.discordId}
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              variant={isOnline ? "default" : "outline"}
                              className={cn(
                                isOnline &&
                                  "bg-green-500/20 text-green-500 hover:bg-green-500/30",
                              )}
                            >
                              {isOnline ? "Online" : "Offline"}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            {isOnline && serverName ? (
                              <p className="text-sm text-foreground">
                                {serverName}
                              </p>
                            ) : (
                              <p className="text-sm text-muted-foreground">—</p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-sm text-muted-foreground">
                              {new Date(player.lastSeen).toLocaleDateString()}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              className="cursor-pointer"
                              onClick={() =>
                                navigate(
                                  `/admin/players/${player.minecraftUuid}`,
                                )
                              }
                            >
                              View
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between border-t border-border p-4">
                <p className="text-sm text-muted-foreground">
                  Showing {page * limit + 1} to{" "}
                  {Math.min((page + 1) * limit, total)} of {total} players
                </p>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page === 0}
                    className="cursor-pointer"
                  >
                    <ChevronLeft className="size-4" />
                    Previous
                  </Button>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const pageNum =
                        totalPages <= 5
                          ? i
                          : page < 3
                            ? i
                            : page > totalPages - 4
                              ? totalPages - 5 + i
                              : page - 2 + i;

                      return (
                        <Button
                          key={pageNum}
                          variant={page === pageNum ? "default" : "outline"}
                          size="sm"
                          onClick={() => handlePageChange(pageNum)}
                          className="cursor-pointer"
                        >
                          {pageNum + 1}
                        </Button>
                      );
                    })}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(page + 1)}
                    disabled={page >= totalPages - 1}
                    className="cursor-pointer"
                  >
                    Next
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
