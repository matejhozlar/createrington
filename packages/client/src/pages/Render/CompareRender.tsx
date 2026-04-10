import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { loadSkin, randomPose } from "./skin-utils";

interface PlayerData {
  username: string;
  uuid: string;
  networth: string;
  playtime: string;
  playtimeSeconds: number;
  sessions: number;
  memberSince: string;
}

interface CompareData {
  player1: PlayerData;
  player2: PlayerData;
}

function formatNumber(value: string): string {
  const num = parseFloat(value);
  if (isNaN(num)) return value;
  return num.toLocaleString("en-US", { maximumFractionDigits: 3 });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Returns 1 if a > b, 2 if b > a, 0 if equal */
function winner(a: number, b: number): 0 | 1 | 2 {
  if (a > b) return 1;
  if (b > a) return 2;
  return 0;
}

function StatRow({
  label,
  value1,
  value2,
  win,
}: {
  label: string;
  value1: string;
  value2: string;
  win: 0 | 1 | 2;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-3 py-2 rounded-md bg-card/60 border border-border">
      <span
        className={`text-left text-[15px] font-semibold ${
          win === 1 ? "text-primary" : "text-muted-foreground"
        }`}
      >
        {value1}
      </span>
      <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground/50 whitespace-nowrap">
        {label}
      </span>
      <span
        className={`text-right text-[15px] font-semibold ${
          win === 2 ? "text-primary" : "text-muted-foreground"
        }`}
      >
        {value2}
      </span>
    </div>
  );
}

export function CompareRender() {
  const [params] = useSearchParams();
  const [data, setData] = useState<CompareData | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [skinLeft, setSkinLeft] = useState<string | null>(null);
  const [skinRight, setSkinRight] = useState<string | null>(null);
  const [poseLeft] = useState(randomPose);
  const [poseRight] = useState(randomPose);

  const secret = params.get("secret");
  const p1 = params.get("player1");
  const p2 = params.get("player2");
  const hasMissingParams = !secret || !p1 || !p2;

  useEffect(() => {
    if (hasMissingParams) return;

    const url = new URL("/api/render/compare", window.location.origin);
    url.searchParams.set("secret", secret);
    url.searchParams.set("player1", p1);
    url.searchParams.set("player2", p2);

    fetch(url.toString())
      .then((res) => {
        if (!res.ok) throw new Error("Bad response");
        return res.json() as Promise<CompareData>;
      })
      .then(setData)
      .catch(() => setFetchError("Failed to load comparison data"));
  }, [hasMissingParams, secret, p1, p2]);

  // Load skin images once data arrives — both in parallel
  useEffect(() => {
    if (!data) return;
    loadSkin(data.player1.uuid, poseLeft).then(setSkinLeft);
    loadSkin(data.player2.uuid, poseRight).then(setSkinRight);
  }, [data, poseLeft, poseRight]);

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

  if (!data || !skinLeft || !skinRight) {
    return (
      <div className="w-[900px] h-[500px] bg-background flex items-center justify-center">
        <span className="text-base tracking-wide text-muted-foreground">
          Loading...
        </span>
      </div>
    );
  }

  const left = data.player1;
  const right = data.player2;

  const networthWin = winner(
    parseFloat(left.networth.replace(/,/g, "")),
    parseFloat(right.networth.replace(/,/g, "")),
  );
  const playtimeWin = winner(left.playtimeSeconds, right.playtimeSeconds);
  const sessionsWin = winner(left.sessions, right.sessions);
  // Earlier join date is "better"
  const memberWin = winner(
    new Date(right.memberSince).getTime(),
    new Date(left.memberSince).getTime(),
  );

  return (
    <div
      id="compare-container"
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
      <div className="absolute -left-20 top-8 w-[350px] h-[350px] rounded-full blur-[120px] opacity-20 pointer-events-none bg-chart-1" />
      <div className="absolute -right-20 bottom-8 w-[350px] h-[350px] rounded-full blur-[120px] opacity-20 pointer-events-none bg-chart-5" />

      {/* Header */}
      <div className="flex items-center gap-4 px-8 pt-5 z-10">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
        <img
          src="/assets/render/player-comparison.webp"
          alt="Player Comparison"
          className="h-[44px]"
          style={{ imageRendering: "pixelated" }}
        />
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>

      {/* Body */}
      <div className="flex-1 flex items-center justify-center px-6 pt-2 z-10">
        {/* Player 1 */}
        <div className="flex flex-col items-center w-[200px] shrink-0">
          <div className="relative h-[300px] flex items-end justify-center">
            <div className="absolute bottom-0 w-40 h-40 rounded-full blur-[60px] opacity-40 bg-chart-1" />
            <img
              src={skinLeft}
              alt={left.username}
              className="relative h-[280px] drop-shadow-[0_4px_24px_rgba(0,0,0,0.6)] [image-rendering:pixelated]"
              crossOrigin="anonymous"
            />
          </div>
          <span className="mt-2 text-xl font-bold tracking-wide text-chart-1">
            {left.username}
          </span>
        </div>

        {/* Stats center */}
        <div className="flex-1 flex flex-col items-center gap-3 px-2">
          <span className="text-2xl font-bold tracking-[0.15em] text-foreground/10">
            VS
          </span>
          <div className="flex flex-col gap-2.5 w-full">
            <StatRow
              label="NETWORTH"
              value1={`$${formatNumber(left.networth)}`}
              value2={`$${formatNumber(right.networth)}`}
              win={networthWin}
            />
            <StatRow
              label="PLAYTIME"
              value1={left.playtime}
              value2={right.playtime}
              win={playtimeWin}
            />
            <StatRow
              label="SESSIONS"
              value1={left.sessions.toLocaleString()}
              value2={right.sessions.toLocaleString()}
              win={sessionsWin}
            />
            <StatRow
              label="MEMBER SINCE"
              value1={formatDate(left.memberSince)}
              value2={formatDate(right.memberSince)}
              win={memberWin}
            />
          </div>
        </div>

        {/* Player 2 */}
        <div className="flex flex-col items-center w-[200px] shrink-0">
          <div className="relative h-[300px] flex items-end justify-center">
            <div className="absolute bottom-0 w-40 h-40 rounded-full blur-[60px] opacity-40 bg-chart-5" />
            <img
              src={skinRight}
              alt={right.username}
              className="relative h-[280px] -scale-x-100 drop-shadow-[0_4px_24px_rgba(0,0,0,0.6)] [image-rendering:pixelated]"
              crossOrigin="anonymous"
            />
          </div>
          <span className="mt-2 text-xl font-bold tracking-wide text-chart-5">
            {right.username}
          </span>
        </div>
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
