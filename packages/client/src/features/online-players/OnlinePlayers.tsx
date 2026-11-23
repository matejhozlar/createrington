import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router";
import { formatCompactDuration } from "@createrington/shared/format";
import { usePlayerData, type OnlinePlayer } from "@/contexts/player-data";
import { useServerData } from "@/contexts/server-data";
import { useAuth } from "@/contexts/auth";
import { cn } from "@/lib/utils";
import { MinecraftAvatar } from "@/components/minecraft-avatar";
import { Badge } from "@/components/ui/badge";
import { SearchInput } from "@/components/search-input";
import { ErrorState, LoadingState } from "@/components/query-states";
import {
  Search,
  Users,
  Clock,
  Activity,
  Radio,
  Signal,
  WifiOff,
  type LucideIcon,
} from "lucide-react";
import { useNow } from "@/hooks/use-now";
import { MAIN_SERVER_ID } from "@/lib/minecraft";
import { plural, pluralize } from "@/lib/format";

function getSessionSeconds(player: OnlinePlayer, now: number): number {
  return Math.max(0, (now - player.sessionStart.getTime()) / 1000);
}

function SessionTimer({ player }: { player: OnlinePlayer }) {
  const now = useNow(1000);
  const seconds = getSessionSeconds(player, now);

  return (
    <span className="tabular-nums text-muted-foreground text-sm font-mono">
      {formatCompactDuration(seconds)}
    </span>
  );
}

function StatBlock({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
        {icon}
      </div>
      <div>
        <p className="text-xl font-bold text-foreground leading-none tabular-nums">
          {value}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </div>
    </div>
  );
}

function PlayerCard({
  player,
  index,
  onClick,
}: {
  player: OnlinePlayer;
  index: number;
  onClick?: () => void;
}) {
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => e.key === "Enter" && onClick() : undefined}
      className={cn(
        "group relative flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition-all duration-300 hover:border-primary/30 hover:bg-card/80",
        onClick && "cursor-pointer",
      )}
      style={{
        animation: `fade-in-up 0.4s ease-out ${index * 40}ms both`,
      }}
    >
      <div className="absolute top-3 right-3">
        <span className="relative flex size-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-60" />
          <span className="relative inline-flex size-2.5 rounded-full bg-green-500" />
        </span>
      </div>

      <div className="relative shrink-0">
        <MinecraftAvatar
          username={player.username}
          uuid={player.uuid}
          size={48}
          className="ring-2 ring-border group-hover:ring-primary/40 transition-all duration-300"
        />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-semibold text-foreground group-hover:text-primary transition-colors duration-300">
          {player.username}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <Clock className="size-3 text-muted-foreground shrink-0" />
          <SessionTimer player={player} />
        </div>
      </div>
    </div>
  );
}

function PlayersEmpty({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Icon className="mb-4 size-12 text-muted-foreground" />
      <p className="text-lg font-medium text-foreground">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export function OnlinePlayers() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.isAdmin ?? false;

  const {
    getServerPlayers,
    loading: playersLoading,
    error: playersError,
    refresh,
  } = usePlayerData();
  const { servers } = useServerData();
  const server = servers.find((s) => s.serverId === MAIN_SERVER_ID);

  const [searchQuery, setSearchQuery] = useState("");

  const serverPlayers = useMemo(
    () => getServerPlayers(MAIN_SERVER_ID),
    [getServerPlayers],
  );

  const filteredPlayers = useMemo(() => {
    if (!searchQuery.trim()) return serverPlayers;
    const q = searchQuery.toLowerCase().trim();
    return serverPlayers.filter((p) => p.username.toLowerCase().includes(q));
  }, [serverPlayers, searchQuery]);

  const sortedPlayers = useMemo(
    () =>
      [...filteredPlayers].sort(
        (a, b) => a.sessionStart.getTime() - b.sessionStart.getTime(),
      ),
    [filteredPlayers],
  );

  const now = useNow(5000);
  const avgSession =
    serverPlayers.length === 0
      ? 0
      : serverPlayers.reduce((sum, p) => sum + getSessionSeconds(p, now), 0) /
        serverPlayers.length;

  const isOnline = server?.online ?? false;
  const serverName = server?.serverName ?? "Rails 'n Sails";
  const playerCount = serverPlayers.length;
  const maxPlayers = server?.maxPlayers ?? 0;
  const capacityPercent =
    maxPlayers > 0 ? Math.round((playerCount / maxPlayers) * 100) : 0;

  return (
    <div>
      <header className="relative w-full overflow-hidden py-12 md:py-16 px-5 md:px-8">
        <div className="absolute inset-0">
          <img
            src="/assets/hero/dark-warehouse.webp"
            alt="Server players"
            className="h-full w-full object-cover grayscale-50"
          />
          <div className="absolute inset-0 bg-black/50" />
        </div>
        <div className="absolute inset-x-0 bottom-0 h-48 bg-linear-to-t from-background to-transparent" />

        <div className="relative max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <Badge
              tone={isOnline ? "success" : "danger"}
              className="gap-1.5 px-3 py-1 text-sm"
            >
              {isOnline ? (
                <Signal className="size-3.5" />
              ) : (
                <WifiOff className="size-3.5" />
              )}
              {isOnline ? "Server Online" : "Server Offline"}
            </Badge>

            {isOnline && maxPlayers > 0 && (
              <Badge variant="outline" className="gap-1.5 px-3 py-1 text-sm">
                <Activity className="size-3.5" />
                {playerCount}/{maxPlayers} slots
              </Badge>
            )}
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold text-foreground">
            Online Players
          </h1>

          <p className="mt-4 text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl">
            {isOnline
              ? playerCount > 0
                ? `${pluralize(playerCount, "player")} currently exploring ${serverName}`
                : "No one is online right now — be the first to join!"
              : "The server is currently offline. Check back soon!"}
          </p>
        </div>
      </header>

      <section className="px-5 md:px-8 pb-16">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="flex flex-wrap gap-x-8 gap-y-4 rounded-xl border border-border bg-card/60 backdrop-blur-sm p-5">
            <StatBlock
              icon={<Users className="size-5 text-primary" />}
              value={playerCount}
              label="Online now"
            />
            <StatBlock
              icon={<Radio className="size-5 text-primary" />}
              value={`${capacityPercent}%`}
              label="Server load"
            />
            <StatBlock
              icon={<Clock className="size-5 text-primary" />}
              value={avgSession > 0 ? formatCompactDuration(avgSession) : "—"}
              label="Avg session"
            />
          </div>

          {playerCount > 0 && (
            <SearchInput
              className="max-w-sm"
              placeholder="Search players..."
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
          )}

          {playersLoading ? (
            <LoadingState text="Loading players..." className="py-16" />
          ) : playersError ? (
            <ErrorState
              message={playersError.message}
              onRetry={() => refresh()}
              className="py-16"
            />
          ) : sortedPlayers.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {sortedPlayers.map((player, i) => (
                <PlayerCard
                  key={player.uuid}
                  player={player}
                  index={i}
                  onClick={
                    isAdmin
                      ? () => navigate(`/admin/players/${player.uuid}`)
                      : undefined
                  }
                />
              ))}
            </div>
          ) : searchQuery.trim() ? (
            <PlayersEmpty
              icon={Search}
              title="No players found"
              description={`No online player matches "${searchQuery}"`}
            />
          ) : !isOnline ? (
            <PlayersEmpty
              icon={WifiOff}
              title="Server Offline"
              description="The server is currently offline. Players will appear here when it's back up."
            />
          ) : (
            <PlayersEmpty
              icon={Users}
              title="No one is online"
              description="Be the first to join and start building!"
            />
          )}

          {searchQuery.trim() && sortedPlayers.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Showing {sortedPlayers.length} of {playerCount} online{" "}
              {plural(playerCount, "player")}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
