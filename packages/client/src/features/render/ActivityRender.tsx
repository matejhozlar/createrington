import { RenderFrame, RenderWordmark } from "./components/RenderFrame";
import { cn } from "@/lib/utils";
import { formatPlaytime } from "@createrington/shared/format";
import { LoadingScreen } from "@/components/query-states";
import { playerAvatarUrl } from "@/lib/playerImages";
import { RenderTeamTag } from "./components/RenderTeamTag";
import { RenderUnavailable } from "./components/RenderUnavailable";
import {
  buildHeatmapGrid,
  HEATMAP_DAY_LABELS,
  HEATMAP_LEVEL_LABELS,
  heatmapLevel,
} from "@/lib/activityHeatmap";
import { useRenderData } from "./hooks/use-render-data";
import { useRenderPlatesReady } from "./hooks/use-render-plates";
import { pluralize } from "@/lib/format";

interface ActivityData {
  username: string;
  uuid: string;
  online: boolean;
  currentSessionSeconds: number | null;
  totalSeconds: number;
  currentStreak: number;
  mostActiveDay: string;
  days: Record<string, number>;
  tagCode: string | null;
}

const NUM_WEEKS = 26;

const LEVEL_COLORS = [
  "bg-muted/50",
  "bg-green-500/20",
  "bg-green-500/40",
  "bg-green-500/60",
  "bg-green-500/80",
];

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

  const platesReady = useRenderPlatesReady();

  if (unavailable) return <RenderUnavailable reason={unavailable} />;
  if (!data || !platesReady) return <LoadingScreen />;

  const avatarSrc = playerAvatarUrl(data.uuid);
  const { weeks, monthLabels } = buildHeatmapGrid(data.days, NUM_WEEKS);
  const cellSpacing = (900 - 64 - 36) / NUM_WEEKS;

  return (
    <RenderFrame
      id="activity-container"
      banner={{
        src: "/assets/render/player-activity.webp",
        alt: "Player Activity",
      }}
      glows={[
        "-left-16 top-12 h-[320px] w-[320px] bg-emerald-500 opacity-20",
        "-right-16 -bottom-8 h-[280px] w-[280px] bg-chart-3 opacity-10",
      ]}
      footer={
        <div className="flex items-center justify-between px-8 pb-4 z-10">
          <div className="flex items-center gap-2.5">
            {LEVEL_COLORS.map((color, i) => (
              <div key={i} className="flex items-center gap-1">
                <div className={cn("size-4 rounded-sm", color)} />
                <span className="text-[11px] text-muted-foreground font-medium">
                  {HEATMAP_LEVEL_LABELS[i]}
                </span>
              </div>
            ))}
          </div>
          <RenderWordmark />
        </div>
      }
    >
      <div className="flex items-center gap-6 px-8 pt-5 pb-2 z-10">
        <img
          src={avatarSrc}
          alt={data.username}
          className="w-[100px] h-[100px] rounded-md drop-shadow-[0_2px_12px_rgba(0,0,0,0.5)]"
        />
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-3">
            <div className="flex items-baseline gap-3">
              <RenderTeamTag code={data.tagCode} height={27} inline />
              <h2 className="text-3xl font-bold tracking-wide text-foreground">
                {data.username}
              </h2>
            </div>
            <div className="flex items-center gap-1.5">
              <div
                className={cn(
                  "h-2.5 w-2.5 rounded-full",
                  data.online
                    ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]"
                    : "bg-muted-foreground/40",
                )}
              />
              <span
                className={cn(
                  "text-[12px] font-semibold tracking-wide uppercase",
                  data.online ? "text-emerald-400" : "text-muted-foreground/40",
                )}
              >
                {data.online ? "Online" : "Offline"}
              </span>
            </div>
          </div>
          <div className="flex gap-2.5">
            <StatPill label="Total" value={formatPlaytime(data.totalSeconds)} />
            <StatPill
              label="Streak"
              value={pluralize(data.currentStreak, "day")}
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

      <div className="flex-1 flex flex-col justify-center px-8 z-10">
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
                  className={cn(
                    "aspect-square flex-1 rounded-sm",
                    day.future
                      ? "opacity-0"
                      : LEVEL_COLORS[heatmapLevel(day.seconds)],
                  )}
                  title={`${day.date}: ${formatPlaytime(day.seconds)}`}
                />
              );
            })}
          </div>
        ))}
      </div>
    </RenderFrame>
  );
}
