import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { LoadingState } from "@/components/query-states";
import { StatCard } from "@/components/stat-card";
import { AdminPage } from "@/features/admin/components/AdminPage";
import { AdminPageTitle } from "@/features/admin/components/AdminPageTitle";
import { FilterBar } from "@/features/admin/components/FilterBar";
import { TableCard } from "@/components/paged-table";
import { useAdminPlayers } from "@/contexts/admin";
import { CellDate, CellText } from "@/components/cell-text";
import {
  AvatarCellSkeleton,
  BadgeCellSkeleton,
  type DataTableColumn,
} from "@/components/data-table";
import { PresenceBadge } from "@/components/presence-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Users, TrendingUp, Coins, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { MinecraftAvatar } from "@/components/minecraft-avatar";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { usePagedQuery } from "@/hooks/use-paged-query";
import { useTableSort } from "@/hooks/use-table-sort";
import { useQuery } from "@tanstack/react-query";
import { trpc, type RouterOutput } from "@/lib/trpc";
import { formatMoney } from "@createrington/shared/format";
import { isDiscordId } from "@createrington/shared/discord-id";

type PlayerRow =
  RouterOutput["admin"]["players"]["players"]["list"]["items"][number];

type SortField = "minecraftUsername" | "lastSeen" | "createdAt";

type ViolationFilter = "all" | "strikes" | "bans" | "any";

type OnlineFilter = "all" | "online" | "offline";

const ONLINE_FILTER_OPTIONS: { value: OnlineFilter; label: string }[] = [
  { value: "all", label: "All Statuses" },
  { value: "online", label: "Online" },
  { value: "offline", label: "Offline" },
];

const VIOLATION_FILTER_OPTIONS: { value: ViolationFilter; label: string }[] = [
  { value: "all", label: "All Players" },
  { value: "any", label: "Any Violations" },
  { value: "strikes", label: "With Strikes" },
  { value: "bans", label: "With Bans" },
];

type Violation = "ban" | "strike";

const VIOLATION_STYLES: Record<Violation, { dot: string; row: string }> = {
  ban: { dot: "bg-destructive", row: "bg-destructive/5" },
  strike: { dot: "bg-tone-warning", row: "bg-tone-warning/5" },
};

function violationOf(
  player: PlayerRow,
): { count: number; kind: Violation } | null {
  const strikes = player.activeStrikeCount ?? 0;
  const bans = player.activeBanCount ?? 0;
  if (strikes + bans === 0) return null;
  return { count: strikes + bans, kind: bans > 0 ? "ban" : "strike" };
}

type SearchFilters = {
  discordId?: string;
  minecraftUuid?: string;
  minecraftUsername?: string;
};

function classifySearch(input: string): SearchFilters {
  const trimmed = input.trim();
  if (!trimmed) return {};

  if (isDiscordId(trimmed)) {
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

  const [searchQuery, setSearchQuery] = useState("");
  const [onlineFilter, setOnlineFilter] = useState<OnlineFilter>("all");
  const [violationFilter, setViolationFilter] =
    useState<ViolationFilter>("all");

  const sort = useTableSort<SortField>("lastSeen");

  const debouncedSearch = useDebouncedValue(searchQuery);
  const searchFilters = useMemo(
    () => classifySearch(debouncedSearch),
    [debouncedSearch],
  );

  const statsQuery = useQuery(trpc.admin.players.players.stats.queryOptions());

  const players = usePagedQuery(
    {
      ...sort.order,
      ...searchFilters,
      online: onlineFilter === "all" ? undefined : onlineFilter === "online",
      hasStrikes: violationFilter === "strikes" ? true : undefined,
      hasBans: violationFilter === "bans" ? true : undefined,
      hasViolations: violationFilter === "any" ? true : undefined,
      includeStrikeCounts: true,
      includeBanCounts: true,
    },
    (input) => trpc.admin.players.players.list.queryOptions(input),
  );

  const stats = statsQuery.data;
  const statsLoading = statsQuery.isLoading;

  const navigate = useNavigate();

  const columns: DataTableColumn<PlayerRow>[] = [
    {
      key: "player",
      header: "Player",
      minWidth: 240,
      ...sort.column("minecraftUsername"),
      skeleton: () => <AvatarCellSkeleton />,
      render: (player) => {
        const violation = violationOf(player);
        return (
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative shrink-0">
              <MinecraftAvatar
                uuid={player.minecraftUuid}
                username={player.minecraftUsername}
              />
              {violation && (
                <div
                  className={cn(
                    "absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full text-[10px] font-bold text-white ring-2 ring-background",
                    VIOLATION_STYLES[violation.kind].dot,
                  )}
                >
                  {violation.count}
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
      ...sort.column("lastSeen"),
      render: (player) => <CellDate value={player.lastSeen} relative />,
    },
  ];

  return (
    <AdminPage
      trail={[
        { label: "Admin", href: "/admin/dashboard" },
        { label: "Players" },
      ]}
    >
      <AdminPageTitle title="Players" />
      {statsLoading ? (
        <LoadingState text="Loading statistics..." className="flex-none py-8" />
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
            value={formatMoney(Number(stats.balance.total))}
            icon={Coins}
            tone="chart-3"
            footer={`Avg: ${formatMoney(Number(stats.balance.average))}`}
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

      <FilterBar
        search={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="Search by username, Discord ID, or UUID..."
        activeCount={
          (searchQuery ? 1 : 0) +
          (onlineFilter !== "all" ? 1 : 0) +
          (violationFilter !== "all" ? 1 : 0)
        }
      >
        <Select
          value={onlineFilter}
          onValueChange={(v) => setOnlineFilter(v as OnlineFilter)}
        >
          <SelectTrigger className="min-w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ONLINE_FILTER_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={violationFilter}
          onValueChange={(v) => setViolationFilter(v as ViolationFilter)}
        >
          <SelectTrigger className="min-w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {VIOLATION_FILTER_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterBar>

      <TableCard
        title="Players"
        paged={players}
        empty={{
          icon: Users,
          message: "No players found",
          hint:
            violationFilter !== "all" && "Try changing the violation filter",
        }}
        itemLabel="player"
        columns={columns}
        rowKey={(player) => player.minecraftUuid}
        onRowClick={(player) =>
          navigate(`/admin/players/${player.minecraftUuid}`)
        }
        rowClassName={(player) => {
          const violation = violationOf(player);
          return violation ? VIOLATION_STYLES[violation.kind].row : undefined;
        }}
      />
    </AdminPage>
  );
}
