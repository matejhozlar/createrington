import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Loading } from "@/components/loading-spinner";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Paginator } from "@/components/paginator";
import { useAdminPlayers } from "@/contexts/admin";
import { CellText } from "@/components/cell-text";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Filter,
  Users,
  TrendingUp,
  Coins,
  UserPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PlayerApiData } from "@createrington/shared/db";
import { MinecraftAvatar } from "@/components/minecraft-avatar";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { keepPreviousData } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc";
import { formatRelativeDate, formatFullDate } from "./format";

interface PlayerWithCounts extends PlayerApiData {
  activeStrikeCount?: number;
  activeBanCount?: number;
}

type SortField = "minecraftUsername" | "lastSeen" | "createdAt";

type ViolationFilter = "all" | "strikes" | "bans" | "any";

type SearchFilters = {
  discordId?: string;
  minecraftUuid?: string;
  minecraftUsername?: string;
};

function classifySearch(input: string): SearchFilters {
  const trimmed = input.trim();
  if (!trimmed) return {};

  if (/^\d{17,20}$/.test(trimmed)) {
    return { discordId: trimmed };
  }

  const stripped = trimmed.replace(/-/g, "");
  if (/^[0-9a-f]{32}$/i.test(stripped)) {
    const lower = stripped.toLowerCase();
    return {
      minecraftUuid: `${lower.slice(0, 8)}-${lower.slice(8, 12)}-${lower.slice(12, 16)}-${lower.slice(16, 20)}-${lower.slice(20, 32)}`,
    };
  }

  return { minecraftUsername: trimmed };
}

export function AdminPlayers() {
  const { isPlayerOnline, getPlayerServerId, getServerName } =
    useAdminPlayers();

  const [page, setPage] = useState(0);
  const [limit] = useState(20);

  const [searchQuery, setSearchQuery] = useState("");
  const [onlineFilter, setOnlineFilter] = useState<boolean | undefined>(
    undefined,
  );
  const [violationFilter, setViolationFilter] =
    useState<ViolationFilter>("all");

  const [orderBy, setOrderBy] = useState<SortField>("lastSeen");
  const [orderDirection, setOrderDirection] = useState<"asc" | "desc">("desc");

  const debouncedSearch = useDebouncedValue(searchQuery, 1000);
  const searchFilters = useMemo(
    () => classifySearch(debouncedSearch),
    [debouncedSearch],
  );

  const statsQuery = trpc.admin.players.players.stats.useQuery();

  const playersQuery = trpc.admin.players.players.list.useQuery(
    {
      page,
      limit,
      orderBy,
      orderDirection,
      ...searchFilters,
      online: onlineFilter,
      hasStrikes: violationFilter === "strikes" ? true : undefined,
      hasBans: violationFilter === "bans" ? true : undefined,
      hasViolations: violationFilter === "any" ? true : undefined,
      includeStrikeCounts: true,
      includeBanCounts: true,
    },
    { placeholderData: keepPreviousData },
  );

  const stats = statsQuery.data;
  const statsLoading = statsQuery.isLoading;
  const players = (playersQuery.data?.players ?? []) as PlayerWithCounts[];
  const total = playersQuery.data?.pagination.total ?? 0;
  const totalPages = playersQuery.data?.pagination.totalPages ?? 0;
  const loading = playersQuery.isLoading || playersQuery.isPlaceholderData;
  const loadingRows =
    total > 0 ? Math.min(limit, Math.max(total - page * limit, 1)) : limit;
  const error = playersQuery.error?.message ?? null;

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
  }, []);

  const handleSort = useCallback(
    (field: SortField) => {
      if (orderBy === field) {
        setOrderDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      } else {
        setOrderBy(field);
        setOrderDirection("asc");
      }
      setPage(0);
    },
    [orderBy],
  );

  const getPlayerBadgeInfo = useCallback((player: PlayerWithCounts) => {
    const strikeCount = player.activeStrikeCount ?? 0;
    const banCount = player.activeBanCount ?? 0;
    const totalCount = strikeCount + banCount;

    if (totalCount === 0) {
      return { count: 0, color: null, hasIssues: false };
    }

    // Any bans (with or without strikes) → red; strikes-only → yellow.
    if (banCount > 0) {
      return { count: totalCount, color: "red" as const, hasIssues: true };
    }

    return { count: totalCount, color: "yellow" as const, hasIssues: true };
  }, []);

  const navigate = useNavigate();

  const columns: DataTableColumn<PlayerWithCounts>[] = [
    {
      key: "player",
      header: "Player",
      minWidth: 240,
      sorted: orderBy === "minecraftUsername" ? orderDirection : false,
      onSort: () => handleSort("minecraftUsername"),
      skeleton: () => (
        <div className="flex items-center gap-3">
          <Skeleton className="size-8 shrink-0 rounded-xs" />
          <div className="min-w-0">
            <div className="flex h-5 items-center">
              <Skeleton className="h-4 w-28" />
            </div>
            <div className="flex h-4 items-center">
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        </div>
      ),
      render: (player) => {
        const badgeInfo = getPlayerBadgeInfo(player);
        return (
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative shrink-0">
              <MinecraftAvatar
                uuid={player.minecraftUuid}
                username={player.minecraftUsername}
              />
              {badgeInfo.hasIssues && (
                <div
                  className={cn(
                    "absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full text-[10px] font-bold text-white ring-2 ring-background",
                    badgeInfo.color === "yellow" && "bg-yellow-500",
                    badgeInfo.color === "red" && "bg-destructive",
                  )}
                >
                  {badgeInfo.count}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <CellText
                copy
                value={player.minecraftUsername}
                className="font-medium"
              />
              <CellText
                copy
                value={player.minecraftUuid}
                display={`${player.minecraftUuid.slice(0, 8)}...`}
                className="text-xs text-muted-foreground"
              />
            </div>
          </div>
        );
      },
    },
    {
      key: "discordId",
      header: "Discord ID",
      width: 210,
      render: (player) => (
        <CellText
          copy
          value={player.discordId}
          className="font-mono text-sm text-muted-foreground"
        />
      ),
    },
    {
      key: "status",
      header: "Status",
      width: 110,
      skeleton: () => <Skeleton className="h-[22px] w-14 rounded-full" />,
      render: (player) => {
        const isOnline = isPlayerOnline(player.minecraftUuid);
        return (
          <Badge
            variant={isOnline ? "default" : "outline"}
            className={cn(
              isOnline &&
                "bg-green-500/20 text-green-500 hover:bg-green-500/30",
            )}
          >
            {isOnline ? "Online" : "Offline"}
          </Badge>
        );
      },
    },
    {
      key: "server",
      header: "Server",
      minWidth: 140,
      render: (player) => {
        if (!isPlayerOnline(player.minecraftUuid)) return null;
        const serverId = getPlayerServerId(player.minecraftUuid);
        const serverName = serverId ? getServerName(serverId) : null;
        return (
          serverName && <CellText value={serverName} className="text-sm" />
        );
      },
    },
    {
      key: "lastSeen",
      header: "Last Seen",
      width: 160,
      sorted: orderBy === "lastSeen" ? orderDirection : false,
      onSort: () => handleSort("lastSeen"),
      render: (player) => {
        const iso =
          typeof player.lastSeen === "string"
            ? player.lastSeen
            : new Date(player.lastSeen).toISOString();
        return (
          <CellText
            value={formatFullDate(iso)}
            display={formatRelativeDate(iso)}
            className="text-sm text-muted-foreground"
          />
        );
      },
    },
  ];

  return (
    <div className="flex flex-1 flex-col gap-4">
      {/* Header */}
      <AdminPageHeader
        trail={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Players" },
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
              {(searchQuery ||
                onlineFilter !== undefined ||
                violationFilter !== "all") && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {(searchQuery ? 1 : 0) +
                    (onlineFilter !== undefined ? 1 : 0) +
                    (violationFilter !== "all" ? 1 : 0)}
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
                  placeholder="Search by username, Discord ID, or UUID..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(0);
                  }}
                  className="pl-9"
                />
              </div>

              <Select
                value={
                  onlineFilter === undefined
                    ? "all"
                    : onlineFilter
                      ? "online"
                      : "offline"
                }
                onValueChange={(v) => {
                  setOnlineFilter(v === "all" ? undefined : v === "online");
                  setPage(0);
                }}
              >
                <SelectTrigger className="min-w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                  <SelectItem value="offline">Offline</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={violationFilter}
                onValueChange={(v) => {
                  setViolationFilter(v as ViolationFilter);
                  setPage(0);
                }}
              >
                <SelectTrigger className="min-w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Players</SelectItem>
                  <SelectItem value="any">Any Violations</SelectItem>
                  <SelectItem value="strikes">With Strikes</SelectItem>
                  <SelectItem value="bans">With Bans</SelectItem>
                </SelectContent>
              </Select>

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

          {error ? (
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
          ) : !loading && players.length === 0 ? (
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
                <DataTable
                  columns={columns}
                  rows={players}
                  loading={loading}
                  loadingRows={loadingRows}
                  rowKey={(player) => player.minecraftUuid}
                  onRowClick={(player) =>
                    navigate(`/admin/players/${player.minecraftUuid}`)
                  }
                  rowClassName={(player) => {
                    const badgeInfo = getPlayerBadgeInfo(player);
                    if (!badgeInfo.hasIssues) return undefined;
                    return badgeInfo.color === "red"
                      ? "bg-destructive/5"
                      : "bg-yellow-500/5";
                  }}
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
                    itemLabel="player"
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
