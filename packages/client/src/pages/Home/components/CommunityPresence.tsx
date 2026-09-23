import { useMemo } from "react";
import { usePlayerData } from "@/contexts/player-data";
import { useServerData } from "@/contexts/server-data";
import { trpc, type RouterOutput } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { formatRelativeDate } from "@/lib/format";
import { MinecraftAvatar } from "@/components/minecraft-avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { SessionTimer } from "@/components/session-timer";
import { getSessionSeconds } from "@/lib/session";
import type { PlayerData } from "@createrington/shared/socket";

const TILE_SLOTS = 4;
const MAX_ONLINE_TILES = 5;

type RecentPlayer =
  RouterOutput["public"]["players"]["list"]["players"][number];

type PresenceStatus = "online" | "quiet" | "offline";

const STATUS: Record<
  PresenceStatus,
  { label: string; dot: string; text: string; helper?: string }
> = {
  online: { label: "Online now", dot: "bg-green-500", text: "text-green-500" },
  quiet: {
    label: "Quiet right now",
    dot: "bg-muted-foreground",
    text: "text-muted-foreground",
    helper: "Hop on and be the first today.",
  },
  offline: {
    label: "Server offline",
    dot: "bg-destructive",
    text: "text-destructive",
    helper: "Check back soon.",
  },
};

function OnlineTile({ player }: { player: PlayerData }) {
  return (
    <div className="flex items-center gap-3.5 rounded-xl border bg-card p-3">
      <MinecraftAvatar
        username={player.username}
        uuid={player.uuid}
        size={44}
        className="shrink-0"
      />
      <div className="flex min-w-0 flex-col gap-1">
        <span className="truncate text-base font-semibold text-foreground">
          {player.username}
        </span>
        <SessionTimer player={player} />
      </div>
    </div>
  );
}

function RecentTile({ player }: { player: RecentPlayer }) {
  return (
    <div className="flex items-center gap-3.5 rounded-xl border border-dashed p-3">
      <MinecraftAvatar
        username={player.minecraftUsername}
        uuid={player.minecraftUuid}
        size={44}
        className="shrink-0 opacity-55 grayscale"
      />
      <div className="flex min-w-0 flex-col gap-1">
        <span className="truncate text-base font-semibold text-muted-foreground">
          {player.minecraftUsername}
        </span>
        <span className="text-[13px] text-muted-foreground">
          Last seen {formatRelativeDate(player.lastSeen)}
        </span>
      </div>
    </div>
  );
}

function TileSkeleton() {
  return (
    <div className="flex items-center gap-3.5 rounded-xl border p-3">
      <Skeleton className="size-11 shrink-0 rounded-xs" />
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="col-span-full flex items-center gap-3 text-[13px] font-medium text-muted-foreground">
      {label}
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

function Stat({ value, width }: { value: number | undefined; width: string }) {
  if (value === undefined) {
    return (
      <span
        className={cn(
          "inline-block h-4 animate-pulse rounded-md bg-accent align-middle",
          width,
        )}
      />
    );
  }
  return (
    <span className="font-semibold text-foreground">
      {value.toLocaleString()}
    </span>
  );
}

function OverflowTile({ count }: { count: number }) {
  return (
    <div className="flex items-center justify-center rounded-xl border border-dashed border-white/15 p-3 text-[15px] text-muted-foreground">
      +{count} more in game
    </div>
  );
}

function Tiles({
  online,
  recent,
  loading,
  recentLoading,
}: {
  online: PlayerData[];
  recent: RecentPlayer[];
  loading: boolean;
  recentLoading: boolean;
}) {
  if (loading) {
    return Array.from({ length: TILE_SLOTS }, (_, i) => (
      <TileSkeleton key={i} />
    ));
  }

  const onlineTiles = online
    .slice(0, MAX_ONLINE_TILES)
    .map((player) => <OnlineTile key={player.uuid} player={player} />);

  if (online.length > MAX_ONLINE_TILES) {
    return [
      ...onlineTiles,
      <OverflowTile key="overflow" count={online.length - MAX_ONLINE_TILES} />,
    ];
  }

  if (online.length >= TILE_SLOTS) return onlineTiles;

  const recentTiles = recentLoading
    ? Array.from({ length: TILE_SLOTS - online.length }, (_, i) => (
        <TileSkeleton key={`recent-${i}`} />
      ))
    : recent
        .slice(0, TILE_SLOTS - online.length)
        .map((player) => (
          <RecentTile key={player.minecraftUuid} player={player} />
        ));

  if (recentTiles.length === 0) return onlineTiles;

  return [
    ...onlineTiles,
    <Divider
      key="divider"
      label={online.length > 0 ? "Recently online" : "Last online"}
    />,
    ...recentTiles,
  ];
}

export function CommunityPresence({ serverId }: { serverId: number }) {
  const { getServerPlayers, loading: playersLoading } = usePlayerData();
  const { servers } = useServerData();
  const server = servers.find((s) => s.serverId === serverId);

  const online = useMemo(
    () =>
      [...getServerPlayers(serverId)].sort(
        (a, b) => getSessionSeconds(b) - getSessionSeconds(a),
      ),
    [getServerPlayers, serverId],
  );

  const { data: recentData, isLoading: recentLoading } =
    trpc.public.players.list.useQuery(
      {
        online: "false",
        orderBy: "lastSeen",
        orderDirection: "desc",
        limit: TILE_SLOTS,
      },
      { enabled: !playersLoading && online.length < TILE_SLOTS },
    );

  const recent = useMemo(() => {
    const onlineUuids = new Set(online.map((p) => p.uuid));
    return (recentData?.players ?? []).filter(
      (p) => !onlineUuids.has(p.minecraftUuid),
    );
  }, [recentData, online]);

  const { data: playerCount } = trpc.public.players.count.useQuery({});
  const { data: playtimeData } =
    trpc.public.metrics.playtime.getTotalHours.useQuery({});

  const isOnline = server?.online ?? true;
  const maxPlayers = server?.maxPlayers ?? 0;
  const status: PresenceStatus = !isOnline
    ? "offline"
    : online.length > 0
      ? "online"
      : "quiet";
  const { label, dot, text, helper } = STATUS[status];

  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-1 overflow-hidden rounded-xl border bg-background md:grid-cols-[240px_minmax(0,1fr)]">
        <div className="flex flex-col justify-between gap-6 border-b p-7 md:border-r md:border-b-0">
          <div
            className={cn(
              "flex items-center gap-2.5 text-base font-medium",
              text,
            )}
          >
            <span className={cn("size-3 rounded-full", dot)} />
            {label}
          </div>

          <div className="flex flex-col gap-2.5">
            {playersLoading ? (
              <Skeleton className="h-16 w-32 md:h-20 md:w-40" />
            ) : (
              <div
                className={cn(
                  "text-6xl font-bold leading-[0.9] tracking-[-0.03em] tabular-nums md:text-[88px]",
                  status === "online"
                    ? "text-foreground"
                    : "text-muted-foreground",
                )}
              >
                {online.length}
                {maxPlayers > 0 && (
                  <span className="text-[28px] font-semibold tracking-normal text-muted-foreground">
                    /{maxPlayers}
                  </span>
                )}
              </div>
            )}
            {helper && !playersLoading && (
              <span className="text-sm text-muted-foreground">{helper}</span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 content-start gap-3 p-5 sm:grid-cols-2">
          <Tiles
            online={online}
            recent={recent}
            loading={playersLoading}
            recentLoading={recentLoading}
          />
        </div>
      </div>

      <p className="text-base text-muted-foreground">
        <Stat value={playerCount?.count} width="w-12" /> registered community
        members, with <Stat value={playtimeData?.totalHours} width="w-16" />{" "}
        hours of playtime across all seasons.
      </p>
    </div>
  );
}
