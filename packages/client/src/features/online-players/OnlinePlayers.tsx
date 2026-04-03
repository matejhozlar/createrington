import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { usePlayerData } from "@/contexts/player-data";
import { useServerData } from "@/contexts/server-data";
import { useAuth } from "@/contexts/auth";
import { cn } from "@/lib/utils";
import { MinecraftAvatar } from "@/components/minecraft-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loading } from "@/components/loading-spinner";
import {
  Search,
  Users,
  Clock,
  Activity,
  Radio,
  Signal,
  WifiOff,
} from "lucide-react";
import type { PlayerData } from "@createrington/shared/socket";

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (h > 0) {
    return `${h}h ${m}m`;
  }
  if (m > 0) {
    return `${m}m ${s}s`;
  }
  return `${s}s`;
}

function getSessionSeconds(player: PlayerData): number {
  const start =
    player.sessionStart instanceof Date
      ? player.sessionStart.getTime()
      : new Date(player.sessionStart).getTime();
  return Math.max(0, (Date.now() - start) / 1000);
}

/** Live-ticking session timer for a single player */
function SessionTimer({ player }: { player: PlayerData }) {
  const [seconds, setSeconds] = useState(() => getSessionSeconds(player));

  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds(getSessionSeconds(player));
    }, 1000);
    return () => clearInterval(interval);
  }, [player]);

  return (
    <span className="tabular-nums text-muted-foreground text-sm font-mono">
      {formatDuration(seconds)}
    </span>
  );
}

/** Stat card used in the overview strip */
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

/** Individual player card */
function PlayerCard({
  player,
  index,
  onClick,
}: {
  player: PlayerData;
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
      {/* Online pulse indicator */}
      <div className="absolute top-3 right-3">
        <span className="relative flex size-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-60" />
          <span className="relative inline-flex size-2.5 rounded-full bg-green-500" />
        </span>
      </div>

      {/* Avatar */}
      <div className="relative shrink-0">
        <MinecraftAvatar
          username={player.username}
          uuid={player.uuid}
          size={48}
          className="ring-2 ring-border group-hover:ring-primary/40 transition-all duration-300"
        />
      </div>

      {/* Info */}
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

export function OnlinePlayers() {
  // TODO: When converting to multiple servers, update this to use the selected server
  const serverId = 1;

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
  const server = servers.find((s) => s.serverId === serverId);

  const [searchQuery, setSearchQuery] = useState("");

  const serverPlayers = useMemo(
    () => getServerPlayers(serverId),
    [getServerPlayers, serverId],
  );

  const filteredPlayers = useMemo(() => {
    if (!searchQuery.trim()) return serverPlayers;
    const q = searchQuery.toLowerCase().trim();
    return serverPlayers.filter((p) => p.username.toLowerCase().includes(q));
  }, [serverPlayers, searchQuery]);

  // Sort by session duration (longest first)
  const sortedPlayers = useMemo(
    () =>
      [...filteredPlayers].sort((a, b) => {
        const aStart =
          a.sessionStart instanceof Date
            ? a.sessionStart.getTime()
            : new Date(a.sessionStart).getTime();
        const bStart =
          b.sessionStart instanceof Date
            ? b.sessionStart.getTime()
            : new Date(b.sessionStart).getTime();
        return aStart - bStart;
      }),
    [filteredPlayers],
  );

  // Live-updating average session time
  const computeAvg = useCallback(() => {
    if (serverPlayers.length === 0) return 0;
    const total = serverPlayers.reduce(
      (sum, p) => sum + getSessionSeconds(p),
      0,
    );
    return total / serverPlayers.length;
  }, [serverPlayers]);

  const [avgSession, setAvgSession] = useState(computeAvg);

  useEffect(() => {
    const interval = setInterval(() => setAvgSession(computeAvg()), 5000);
    return () => clearInterval(interval);
  }, [computeAvg]);

  const isOnline = server?.online ?? false;
  const playerCount = serverPlayers.length;
  const maxPlayers = server?.maxPlayers ?? 0;
  const capacityPercent =
    maxPlayers > 0 ? Math.round((playerCount / maxPlayers) * 100) : 0;

  return (
    <div>
      {/* Hero header */}
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
              className={`gap-1.5 px-3 py-1 text-sm ${isOnline ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-destructive/20 text-destructive border-destructive/30"}`}
              variant="outline"
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
                ? `${playerCount} player${playerCount !== 1 ? "s" : ""} currently exploring Cogs & Steam`
                : "No one is online right now — be the first to join!"
              : "The server is currently offline. Check back soon!"}
          </p>
        </div>
      </header>

      <section className="px-5 md:px-8 pb-16">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Stats strip */}
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
              value={avgSession > 0 ? formatDuration(avgSession) : "—"}
              label="Avg session"
            />
          </div>

          {/* Search bar */}
          {playerCount > 0 && (
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <Input
                type="text"
                placeholder="Search players..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          )}

          {/* Player grid */}
          {playersLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loading size="medium" text="Loading players..." />
            </div>
          ) : playersError ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Users className="size-12 text-muted-foreground mb-4" />
              <p className="text-destructive">{playersError.message}</p>
              <Button
                onClick={() => refresh()}
                className="mt-4"
                variant="outline"
              >
                Try Again
              </Button>
            </div>
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
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Search className="size-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium text-foreground">
                No players found
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                No online player matches "{searchQuery}"
              </p>
            </div>
          ) : !isOnline ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <WifiOff className="size-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium text-foreground">
                Server Offline
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                The server is currently offline. Players will appear here when
                it's back up.
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Users className="size-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium text-foreground">
                No one is online
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Be the first to join and start building!
              </p>
            </div>
          )}

          {/* Result count when searching */}
          {searchQuery.trim() && sortedPlayers.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Showing {sortedPlayers.length} of {playerCount} online player
              {playerCount !== 1 ? "s" : ""}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
