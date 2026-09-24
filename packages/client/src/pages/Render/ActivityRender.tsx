import { formatPlaytime } from "@createrington/shared/format";
import { LoadingScreen } from "@/components/loading-spinner";
import { mcHeadsAvatar } from "@/lib/external-urls";
import { RenderUnavailable } from "./components/RenderUnavailable";
import {
  buildHeatmapGrid,
  HEATMAP_DAY_LABELS,
  HEATMAP_LEVEL_COLORS,
  HEATMAP_LEVEL_LABELS,
  heatmapLevel,
} from "@/lib/activityHeatmap";
import { useRenderData } from "./hooks/use-render-data";

interface ActivityData {
  username: string;
  uuid: string;
  online: boolean;
  currentSessionSeconds: number | null;
  totalSeconds: number;
  currentStreak: number;
  mostActiveDay: string;
  days: Record<string, number>;
}

const NUM_WEEKS = 26;

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

export function ActivityRender() {
  const { data, unavailable } = useRenderData<ActivityData>("activity", [
    "player",
  ]);

  if (unavailable) return <RenderUnavailable reason={unavailable} />;
  if (!data) return <LoadingScreen />;

  const avatarSrc = mcHeadsAvatar(data.uuid);
  const { weeks, monthLabels } = buildHeatmapGrid(data.days, NUM_WEEKS);
  const cellSpacing = (900 - 64 - 36) / NUM_WEEKS;

  return (
    <div
      id="activity-container"
      className="relative w-[900px] h-[500px] overflow-hidden bg-background text-foreground flex flex-col"
    >
      {/* Background grid */}
      <div className="absolute inset-0 pointer-events-none render-bg-grid" />
      <div className="absolute -left-16 top-12 w-[320px] h-[320px] rounded-full blur-[120px] opacity-20 pointer-events-none bg-emerald-500" />
      <div className="absolute -right-16 -bottom-8 w-[280px] h-[280px] rounded-full blur-[120px] opacity-10 pointer-events-none bg-chart-3" />

      {/* Header */}
      <div className="flex items-center gap-4 px-8 pt-5 z-10">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
        <img
          src="/assets/render/player-activity.webp"
          alt="Player Activity"
          className="h-[44px] [image-rendering:pixelated]"
        />
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>

      {/* Player info row */}
      <div className="flex items-center gap-6 px-8 pt-5 pb-2 z-10">
        <img
          src={avatarSrc}
          alt={data.username}
          className="w-[100px] h-[100px] rounded-md drop-shadow-[0_2px_12px_rgba(0,0,0,0.5)]"
        />
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-bold tracking-wide text-foreground">
              {data.username}
            </h2>
            <div className="flex items-center gap-1.5">
              <div
                className={`w-2.5 h-2.5 rounded-full ${data.online ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" : "bg-muted-foreground/40"}`}
              />
              <span
                className={`text-[12px] font-semibold tracking-wide uppercase ${data.online ? "text-emerald-400" : "text-muted-foreground/40"}`}
              >
                {data.online ? "Online" : "Offline"}
              </span>
            </div>
          </div>
          <div className="flex gap-2.5">
            <StatPill label="Total" value={formatPlaytime(data.totalSeconds)} />
            <StatPill
              label="Streak"
              value={`${data.currentStreak} day${data.currentStreak !== 1 ? "s" : ""}`}
            />
            <StatPill label="Most Active" value={data.mostActiveDay} />
            {data.online && data.currentSessionSeconds != null && (
              <StatPill
                label="Session"
                value={formatPlaytime(data.currentSessionSeconds)}
              />
            )}
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
        {HEATMAP_DAY_LABELS.map((label, row) => (
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
                      : HEATMAP_LEVEL_COLORS[heatmapLevel(day.seconds)]
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
        <div className="flex items-center gap-2.5">
          {HEATMAP_LEVEL_COLORS.map((color, i) => (
            <div key={i} className="flex items-center gap-1">
              <div className={`size-4 rounded-sm ${color}`} />
              <span className="text-[11px] text-muted-foreground font-medium">
                {HEATMAP_LEVEL_LABELS[i]}
              </span>
            </div>
          ))}
        </div>
        <span className="text-[11px] font-semibold tracking-[0.3em] uppercase text-foreground/15">
          createrington.com
        </span>
      </div>
    </div>
  );
}
