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
  "bg-muted/30", // 0 — no activity
  "bg-emerald-900/60", // 1 — <1h
  "bg-emerald-700/80", // 2 — 1-2h
  "bg-emerald-500", // 3 — 2-4h
  "bg-emerald-400", // 4 — 4h+
];

const LEGEND = ["None", "<1h", "1-2h", "2-4h", "4h+"];

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

/** Build the grid data: 53 columns × 7 rows, starting from ~52 weeks ago aligned to Monday. */
function buildGrid(days: Record<string, number>) {
  const today = new Date();
  // Find the Monday of the current week
  const todayDay = today.getUTCDay(); // 0=Sun
  const mondayOffset = todayDay === 0 ? 6 : todayDay - 1;

  // Start from 52 weeks before this Monday
  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - mondayOffset - 52 * 7);

  const weeks: { date: string; level: number }[][] = [];
  const monthLabels: { label: string; col: number }[] = [];
  let lastMonth = -1;

  const cursor = new Date(start);
  for (let col = 0; col < 53; col++) {
    const week: { date: string; level: number }[] = [];
    for (let row = 0; row < 7; row++) {
      const dateStr = toDateStr(cursor);
      const isFuture = cursor > today;
      const seconds = isFuture ? -1 : (days[dateStr] ?? 0);
      week.push({ date: dateStr, level: isFuture ? -1 : getLevel(seconds) });

      // Track month boundaries at row 0
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

  // Fetch activity data
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

  // Load avatar
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
      <div className="w-[900px] h-[450px] bg-background flex items-center justify-center">
        <span className="text-base tracking-wide text-destructive">
          {error}
        </span>
      </div>
    );
  }

  if (!data || !avatarSrc) {
    return (
      <div className="w-[900px] h-[450px] bg-background flex items-center justify-center">
        <span className="text-base tracking-wide text-muted-foreground">
          Loading...
        </span>
      </div>
    );
  }

  const { weeks, monthLabels } = buildGrid(data.days);
  const dayLabels = ["Mon", "", "Wed", "", "Fri", "", "Sun"];

  return (
    <div
      id="activity-container"
      className="relative w-[900px] h-[450px] overflow-hidden bg-background text-foreground flex flex-col"
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

      {/* Player info */}
      <div className="flex items-center gap-4 px-8 pt-3 z-10">
        <img
          src={avatarSrc}
          alt={data.username}
          className="w-[48px] h-[48px] rounded drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]"
          crossOrigin="anonymous"
        />
        <div className="flex flex-col gap-0.5">
          <h2 className="text-xl font-bold tracking-wide text-foreground">
            {data.username}
          </h2>
          <div className="flex items-center gap-4">
            <span className="text-[11px] text-muted-foreground">
              <span className="text-foreground/80 font-semibold">
                {formatPlaytime(data.totalSeconds)}
              </span>{" "}
              total
            </span>
            <span className="text-[11px] text-muted-foreground">
              <span className="text-foreground/80 font-semibold">
                {data.currentStreak}
              </span>{" "}
              day streak
            </span>
            <span className="text-[11px] text-muted-foreground">
              Most active:{" "}
              <span className="text-foreground/80 font-semibold">
                {data.mostActiveDay}
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* Heatmap */}
      <div className="flex-1 flex flex-col justify-center px-8 pt-2 pb-1 z-10">
        {/* Month labels */}
        <div className="flex ml-[30px]" style={{ gap: 0 }}>
          {monthLabels.map((m, i) => (
            <span
              key={i}
              className="text-[9px] text-muted-foreground/50 font-medium"
              style={{
                position: "absolute",
                left: `${32 + m.col * 15}px`,
              }}
            >
              {m.label}
            </span>
          ))}
        </div>

        {/* Grid with day labels */}
        <div className="flex gap-0 mt-4">
          {/* Day labels column */}
          <div className="flex flex-col shrink-0" style={{ width: 30, gap: 2 }}>
            {dayLabels.map((label, i) => (
              <div
                key={i}
                className="flex items-center justify-end pr-1.5"
                style={{ height: 11 }}
              >
                <span className="text-[9px] text-muted-foreground/50 font-medium">
                  {label}
                </span>
              </div>
            ))}
          </div>

          {/* Heatmap grid — columns are weeks, rows are days */}
          <div className="flex" style={{ gap: 2 }}>
            {weeks.map((week, col) => (
              <div key={col} className="flex flex-col" style={{ gap: 2 }}>
                {week.map((day, row) => (
                  <div
                    key={row}
                    className={`rounded-[2px] ${day.level === -1 ? "opacity-0" : LEVEL_COLORS[day.level]}`}
                    style={{ width: 11, height: 11 }}
                    title={`${day.date}: ${day.level >= 0 ? formatPlaytime(data.days[day.date] ?? 0) : "future"}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer: legend + branding */}
      <div className="flex items-center justify-between px-8 pb-3.5 z-10">
        <div className="flex items-center gap-1.5">
          {LEVEL_COLORS.map((color, i) => (
            <div key={i} className="flex items-center gap-1">
              <div
                className={`rounded-[2px] ${color}`}
                style={{ width: 9, height: 9 }}
              />
              <span className="text-[8px] text-muted-foreground/40 font-medium">
                {LEGEND[i]}
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
