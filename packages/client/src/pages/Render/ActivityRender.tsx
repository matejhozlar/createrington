import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { mcHeadsAvatar } from "@/lib/external-urls";

interface ActivityData {
  username: string;
  uuid: string;
  totalSeconds: number;
  currentStreak: number;
  mostActiveDay: string;
  days: Record<string, number>;
}

const LEVEL_COLORS = [
  "bg-muted/50",
  "bg-green-500/20",
  "bg-green-500/40",
  "bg-green-500/60",
  "bg-green-500/80",
];

const LEVEL_LABELS = ["None", "<1h", "1-2h", "2-4h", "4h+"];

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const NUM_WEEKS = 26;

function getLevel(seconds: number): number {
  if (seconds <= 0) return 0;
  if (seconds < 3600) return 1;
  if (seconds < 7200) return 2;
  if (seconds < 14400) return 3;
  return 4;
}

function formatPlaytime(seconds: number): string {
  const totalMinutes = Math.floor(seconds / 60);
  const totalHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${totalHours}h ${minutes}m`;
}

function toDateStr(d: Date): string {
  return d.toISOString().split("T")[0];
}

function starlightBustUrl(uuid: string): string {
  return `https://starlightskins.lunareclipse.studio/render/default/${uuid}/bust`;
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-md bg-card/60 border border-border px-5 py-3">
      <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground/50">
        {label}
      </span>
      <span className="text-[17px] font-semibold text-foreground tabular-nums">
        {value}
      </span>
    </div>
  );
}

function buildGrid(days: Record<string, number>) {
  const today = new Date();
  const todayDay = today.getUTCDay();
  const mondayOffset = todayDay === 0 ? 6 : todayDay - 1;

  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - mondayOffset - (NUM_WEEKS - 1) * 7);

  const weeks: { date: string; seconds: number; future: boolean }[][] = [];
  const monthLabels: { label: string; col: number }[] = [];
  let lastMonth = -1;

  const cursor = new Date(start);
  for (let col = 0; col < NUM_WEEKS; col++) {
    const week: { date: string; seconds: number; future: boolean }[] = [];
    for (let row = 0; row < 7; row++) {
      const dateStr = toDateStr(cursor);
      const isFuture = cursor > today;
      week.push({
        date: dateStr,
        seconds: isFuture ? 0 : (days[dateStr] ?? 0),
        future: isFuture,
      });

      if (row === 0) {
        const month = cursor.getUTCMonth();
        if (month !== lastMonth) {
          monthLabels.push({ label: MONTH_LABELS[month], col });
          lastMonth = month;
        }
      }

      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    weeks.push(week);
  }

  return { weeks, monthLabels };
}

export function ActivityRender() {
  const [params] = useSearchParams();
  const [data, setData] = useState<ActivityData | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);

  const secret = params.get("secret");
  const player = params.get("player");
  const hasMissingParams = !secret || !player;

  useEffect(() => {
    if (hasMissingParams) return;

    const url = new URL("/api/render/activity", window.location.origin);
    url.searchParams.set("secret", secret);
    url.searchParams.set("player", player);

    fetch(url.toString())
      .then((res) => {
        if (!res.ok) throw new Error("Bad response");
        return res.json() as Promise<ActivityData>;
      })
      .then(setData)
      .catch(() => setFetchError("Failed to load activity data"));
  }, [hasMissingParams, secret, player]);

  useEffect(() => {
    if (!data) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => setAvatarSrc(img.src);
    img.onerror = () => setAvatarSrc(mcHeadsAvatar(data.uuid));
    img.src = starlightBustUrl(data.uuid);
  }, [data]);

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

  if (!data || !avatarSrc) {
    return (
      <div className="w-[900px] h-[500px] bg-background flex items-center justify-center">
        <span className="text-base tracking-wide text-muted-foreground">
          Loading...
        </span>
      </div>
    );
  }

  const { weeks, monthLabels } = buildGrid(data.days);
  const dayLabels = ["Mon", "", "Wed", "", "Fri", "", "Sun"];
  const cellSpacing = (900 - 64 - 36) / NUM_WEEKS;

  return (
    <div
      id="activity-container"
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
      <div className="absolute -left-16 top-12 w-[320px] h-[320px] rounded-full blur-[120px] opacity-20 pointer-events-none bg-emerald-500" />
      <div className="absolute -right-16 -bottom-8 w-[280px] h-[280px] rounded-full blur-[120px] opacity-10 pointer-events-none bg-chart-3" />

      {/* Header */}
      <div className="flex items-center gap-4 px-8 pt-5 z-10">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
        <h1 className="text-[12px] font-semibold tracking-[0.35em] uppercase text-muted-foreground/40">
          Player Activity
        </h1>
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>

      {/* Player info row */}
      <div className="flex items-center gap-6 px-8 pt-5 pb-2 z-10">
        <img
          src={avatarSrc}
          alt={data.username}
          className="w-[100px] h-[100px] rounded-md drop-shadow-[0_2px_12px_rgba(0,0,0,0.5)]"
          crossOrigin="anonymous"
        />
        <div className="flex flex-col gap-2.5">
          <h2 className="text-3xl font-bold tracking-wide text-foreground">
            {data.username}
          </h2>
          <div className="flex gap-2.5">
            <StatPill label="Total" value={formatPlaytime(data.totalSeconds)} />
            <StatPill
              label="Streak"
              value={`${data.currentStreak} day${data.currentStreak !== 1 ? "s" : ""}`}
            />
            <StatPill label="Most Active" value={data.mostActiveDay} />
          </div>
        </div>
      </div>

      {/* Heatmap */}
      <div className="flex-1 flex flex-col justify-center px-8 z-10">
        {/* Month labels */}
        <div className="relative h-5 ml-[36px]">
          {monthLabels.map((m, i) => (
            <span
              key={i}
              className="absolute text-[11px] text-muted-foreground font-medium"
              style={{ left: `${m.col * cellSpacing}px` }}
            >
              {m.label}
            </span>
          ))}
        </div>

        {/* Grid rows */}
        {dayLabels.map((label, row) => (
          <div key={row} className="flex items-center gap-[3px] mb-[3px]">
            <div className="w-[33px] text-right text-[11px] text-muted-foreground pr-2 shrink-0">
              {label}
            </div>
            {weeks.map((week, col) => {
              const day = week[row];
              return (
                <div
                  key={col}
                  className={`flex-1 aspect-square rounded-sm ${
                    day.future
                      ? "opacity-0"
                      : LEVEL_COLORS[getLevel(day.seconds)]
                  }`}
                  title={`${day.date}: ${formatPlaytime(day.seconds)}`}
                />
              );
            })}
          </div>
        ))}
      </div>

      {/* Footer: legend + branding */}
      <div className="flex items-center justify-between px-8 pb-4 z-10">
        <div className="flex items-center gap-1.5">
          {LEVEL_COLORS.map((color, i) => (
            <div key={i} className="flex items-center gap-1">
              <div className={`size-3 rounded-sm ${color}`} />
              <span className="text-[9px] text-muted-foreground/50 font-medium">
                {LEVEL_LABELS[i]}
              </span>
            </div>
          ))}
        </div>
        <span className="text-[11px] font-semibold tracking-[0.3em] uppercase text-foreground/15">
          create-rington.com
        </span>
      </div>
    </div>
  );
}
