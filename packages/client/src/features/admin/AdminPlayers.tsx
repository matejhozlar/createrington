import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/query-states";
import { StatCard } from "@/components/stat-card";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Paginator } from "@/components/paginator";
import { useAdminPlayers } from "@/contexts/admin";
import { CellText } from "@/components/cell-text";
import {
  AvatarCellSkeleton,
  BadgeCellSkeleton,
  DataTable,
  loadingRowCount,
  type DataTableColumn,
} from "@/components/data-table";
import { SearchInput } from "@/components/search-input";
import { Button } from "@/components/ui/button";
import { PresenceBadge } from "@/components/presence-badge";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Filter, Users, TrendingUp, Coins, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { MinecraftAvatar } from "@/components/minecraft-avatar";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { trpc, type RouterOutput } from "@/lib/trpc";
import { formatMoney } from "@/lib/format";
import { formatRelativeDate } from "@/lib/format";
import { formatFullDate, toIso } from "./format";

type PlayerRow =
  RouterOutput["admin"]["players"]["players"]["list"]["players"][number];

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

  const debouncedSearch = useDebouncedValue(searchQuery);
  const searchFilters = useMemo(
    () => classifySearch(debouncedSearch),
    [debouncedSearch],
  );

  const statsQuery = useQuery(trpc.admin.players.players.stats.queryOptions());

  const playersQuery = useQuery(
    trpc.admin.players.players.list.queryOptions(
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
    ),
  );

  const stats = statsQuery.data;
  const statsLoading = statsQuery.isLoading;
  const players = playersQuery.data?.players ?? [];
  const total = playersQuery.data?.pagination.total ?? 0;
  const totalPages = playersQuery.data?.pagination.totalPages ?? 0;
  const loading = playersQuery.isLoading || playersQuery.isPlaceholderData;
  const loadingRows = loadingRowCount(page, limit, total);
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

  const getPlayerBadgeInfo = useCallback((player: PlayerRow) => {
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

  const columns: DataTableColumn<PlayerRow>[] = [
    {
      key: "player",
      header: "Player",
      minWidth: 240,
      sorted: orderBy === "minecraftUsername" ? orderDirection : false,
      onSort: () => handleSort("minecraftUsername"),
      skeleton: () => <AvatarCellSkeleton />,
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
      skeleton: () => <BadgeCellSkeleton />,
      render: (player) => {
        const isOnline = isPlayerOnline(player.minecraftUuid);
        return <PresenceBadge status={isOnline ? "online" : "offline"} />;
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
        const iso = toIso(player.lastSeen);
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
        {statsLoading ? (
          <LoadingState
            text="Loading statistics..."
            className="flex-none py-8"
          />
        ) : stats ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total Players"
              value={stats.total}
              icon={Users}
              tone="primary"
              footer={`${stats.online} currently online`}
            />
            <StatCard
              label="New This Week"
              value={stats.registered.thisWeek}
              icon={UserPlus}
              tone="chart-2"
              footer={`${stats.registered.today} today`}
            />
            <StatCard
              label="Total Balance"
              value={formatMoney(stats.balance.total)}
              icon={Coins}
              tone="chart-3"
              footer={`Avg: ${formatMoney(stats.balance.average)}`}
            />
            <StatCard
              label="Monthly Growth"
              value={stats.registered.thisMonth}
              icon={TrendingUp}
              tone="chart-4"
              footer="New registrations"
            />
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
              <SearchInput
                className="min-w-48 flex-1"
                placeholder="Search by username, Discord ID, or UUID..."
                value={searchQuery}
                onValueChange={(value) => {
                  setSearchQuery(value);
                  setPage(0);
                }}
              />

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
            <ErrorState
              message={error}
              onRetry={() => playersQuery.refetch()}
            />
          ) : !loading && players.length === 0 ? (
            <EmptyState
              icon={Users}
              message="No players found"
              hint={
                violationFilter !== "all" && "Try changing the violation filter"
              }
            />
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
