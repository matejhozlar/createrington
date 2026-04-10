import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { mcHeadsBody } from "@/lib/external-urls";

interface PlayerEntry {
  username: string;
  uuid: string;
  value: number;
}

interface TopData {
  category: string;
  item: string;
  displayTitle: string;
  players: PlayerEntry[];
}

const SKIN_POSES = [
  "default",
  "marching",
  "walking",
  "crouching",
  "crossed",
  "cheering",
  "trudging",
  "pointing",
  "dungeons",
  "facepalm",
  "kicking",
  "ultimate",
] as const;

function randomPose(): string {
  return SKIN_POSES[Math.floor(Math.random() * SKIN_POSES.length)];
}

function starlightSkinUrl(uuid: string, pose: string): string {
  return `https://starlightskins.lunareclipse.studio/render/${pose}/${uuid}/full`;
}

function loadSkin(uuid: string, pose: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img.src);
    img.onerror = () => resolve(mcHeadsBody(uuid));
    img.src = starlightSkinUrl(uuid, pose);
  });
}

const MEDAL_STYLES = [
  {
    label: "1st",
    border: "border-amber-400/60",
    glow: "bg-amber-400",
    text: "text-amber-400",
    height: "h-[240px]",
    rank: "#1",
  },
  {
    label: "2nd",
    border: "border-zinc-400/50",
    glow: "bg-zinc-400",
    text: "text-zinc-400",
    height: "h-[200px]",
    rank: "#2",
  },
  {
    label: "3rd",
    border: "border-amber-600/50",
    glow: "bg-amber-600",
    text: "text-amber-600",
    height: "h-[200px]",
    rank: "#3",
  },
];

// Display order: #2, #1, #3 (podium layout)
const PODIUM_ORDER = [1, 0, 2];

function PodiumEntry({
  player,
  skinSrc,
  rank,
}: {
  player: PlayerEntry;
  skinSrc: string;
  rank: number;
}) {
  const style = MEDAL_STYLES[rank];

  return (
    <div className="flex flex-col items-center w-[220px]">
      {/* Rank */}
      <span
        className={`text-[18px] font-extrabold tracking-wider ${style.text}`}
      >
        {style.rank}
      </span>
      {/* Skin with glow */}
      <div className="relative flex items-end justify-center mt-1">
        <div
          className={`absolute bottom-0 w-20 h-20 rounded-full blur-[40px] opacity-30 ${style.glow}`}
        />
        <img
          src={skinSrc}
          alt={player.username}
          className={`relative ${style.height} drop-shadow-[0_4px_20px_rgba(0,0,0,0.6)] [image-rendering:pixelated]`}
          crossOrigin="anonymous"
        />
      </div>
      {/* Username + Value */}
      <span
        className={`text-[15px] font-bold tracking-wide mt-2 ${style.text}`}
      >
        {player.username}
      </span>
      <span className="text-[13px] font-semibold text-muted-foreground tabular-nums">
        {player.value.toLocaleString()}
      </span>
    </div>
  );
}

export function TopRender() {
  const [params] = useSearchParams();
  const [data, setData] = useState<TopData | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [skins, setSkins] = useState<string[] | null>(null);
  const [poses] = useState(() => [randomPose(), randomPose(), randomPose()]);

  const secret = params.get("secret");
  const category = params.get("category");
  const item = params.get("item");
  const hasMissingParams = !secret || !category || !item;

  useEffect(() => {
    if (hasMissingParams) return;

    const url = new URL("/api/render/top", window.location.origin);
    url.searchParams.set("secret", secret);
    url.searchParams.set("category", category);
    url.searchParams.set("item", item);

    fetch(url.toString())
      .then((res) => {
        if (!res.ok) throw new Error("Bad response");
        return res.json() as Promise<TopData>;
      })
      .then(setData)
      .catch(() => setFetchError("Failed to load leaderboard data"));
  }, [hasMissingParams, secret, category, item]);

  // Load skins once data arrives
  useEffect(() => {
    if (!data) return;
    if (data.players.length === 0) {
      // No players — mark skins as loaded so the card renders
      Promise.resolve().then(() => setSkins([]));
      return;
    }
    Promise.all(data.players.map((p, i) => loadSkin(p.uuid, poses[i]))).then(
      setSkins,
    );
  }, [data, poses]);

  const error = hasMissingParams ? "Missing parameters" : fetchError;

  if (error) {
    return (
      <div className="w-[900px] h-[500px] bg-background flex items-center justify-center">
        <span className="text-base tracking-wide text-destructive">
          {error}
        </span>
      </div>
    );
  }

  if (!data || !skins) {
    return (
      <div className="w-[900px] h-[500px] bg-background flex items-center justify-center">
        <span className="text-base tracking-wide text-muted-foreground">
          Loading...
        </span>
      </div>
    );
  }

  return (
    <div
      id="top-container"
      className="relative w-[900px] h-[500px] overflow-hidden bg-background text-foreground flex flex-col"
    >
      {/* Background grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(oklch(1 0 0 / 0.03) 1px, transparent 1px), linear-gradient(90deg, oklch(1 0 0 / 0.03) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      {/* Background glows */}
      <div className="absolute left-1/2 -translate-x-1/2 -top-10 w-[400px] h-[400px] rounded-full blur-[120px] opacity-15 pointer-events-none bg-amber-400" />
      <div className="absolute -left-16 bottom-0 w-[280px] h-[280px] rounded-full blur-[120px] opacity-10 pointer-events-none bg-chart-3" />
      <div className="absolute -right-16 bottom-0 w-[280px] h-[280px] rounded-full blur-[120px] opacity-10 pointer-events-none bg-chart-5" />

      {/* Header */}
      <div className="flex items-center gap-4 px-8 pt-5 z-10">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
        <img
          src="/assets/render/player-top.webp"
          alt="Top Players"
          className="h-[44px]"
          style={{ imageRendering: "pixelated" }}
        />
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>
      <div className="text-center pt-2 z-10">
        <h2 className="text-2xl font-bold tracking-wide text-foreground">
          {data.displayTitle}
        </h2>
      </div>

      {/* Podium */}
      <div className="flex-1 flex items-center justify-center gap-1 px-8 z-10">
        {data.players.length === 0 ? (
          <span className="text-lg text-muted-foreground pb-20">
            No players found for this stat
          </span>
        ) : (
          PODIUM_ORDER.map((rank) => {
            const player = data.players[rank];
            const skinSrc = skins[rank];
            if (!player || !skinSrc) return null;
            return (
              <PodiumEntry
                key={rank}
                player={player}
                skinSrc={skinSrc}
                rank={rank}
              />
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="pb-3.5 text-center z-10">
        <span className="text-[11px] font-semibold tracking-[0.3em] uppercase text-foreground/15">
          create-rington.com
        </span>
      </div>
    </div>
  );
}
