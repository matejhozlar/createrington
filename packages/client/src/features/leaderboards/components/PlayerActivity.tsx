import { useLayoutEffect, useRef, useState } from "react";
import { formatPlaytime } from "@createrington/shared/format";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  buildHeatmapGrid,
  HEATMAP_DAY_LABELS,
  HEATMAP_LEVEL_LABELS,
  heatmapLevel,
  parseHeatmapDate,
  type HeatmapDay,
} from "@/lib/activityHeatmap";

const NUM_WEEKS = 52;
const CELL_PITCH = 14;
const MIN_MONTH_GAP = 3;
const LEVEL_COLORS = [
  "bg-muted/50",
  "bg-(--role)/25",
  "bg-(--role)/45",
  "bg-(--role)/70",
  "bg-(--role)",
];

function dayLabel(day: HeatmapDay): string {
  const date = parseHeatmapDate(day.date).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return day.seconds > 0
    ? `${date}: ${formatPlaytime(day.seconds)}`
    : `${date}: no playtime`;
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-md border bg-background/40 px-3 py-2">
      <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
        {label}
      </span>
      <span className="text-sm font-semibold tabular-nums text-foreground">
        {value}
      </span>
    </div>
  );
}

function ActivitySkeleton() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="h-[3.25rem] animate-pulse rounded-md bg-muted/30"
          />
        ))}
      </div>
      <div className="h-[118px] animate-pulse rounded-md bg-muted/30" />
    </div>
  );
}

export function PlayerActivity({ minecraftUuid }: { minecraftUuid: string }) {
  const activityQuery = trpc.public.leaderboards.activity.useQuery(
    { minecraftUuid },
    { staleTime: 60 * 1000 },
  );
  const [hovered, setHovered] = useState<HeatmapDay | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const activity = activityQuery.data;

  useLayoutEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollLeft = node.scrollWidth;
  }, [activity]);

  if (activityQuery.isLoading) return <ActivitySkeleton />;
  if (!activity) {
    return (
      <p className="py-2 text-sm text-muted-foreground">
        Could not load activity.
      </p>
    );
  }

  const { weeks, monthLabels } = buildHeatmapGrid(activity.days, NUM_WEEKS);
  const visibleMonths = monthLabels.filter(
    (month, index) =>
      (monthLabels[index + 1]?.col ?? NUM_WEEKS) - month.col >= MIN_MONTH_GAP,
  );
  const yearSeconds = weeks.flat().reduce((sum, day) => sum + day.seconds, 0);
  const stats = [
    { label: "Total", value: formatPlaytime(activity.totalSeconds) },
    {
      label: "Streak",
      value: `${activity.currentStreak} day${activity.currentStreak === 1 ? "" : "s"}`,
    },
    { label: "Most active", value: activity.mostActiveDay ?? "N/A" },
    activity.online && activity.currentSessionSeconds !== null
      ? {
          label: "Session",
          value: formatPlaytime(activity.currentSessionSeconds),
        }
      : { label: "Status", value: "Offline" },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {stats.map((stat) => (
          <StatPill key={stat.label} label={stat.label} value={stat.value} />
        ))}
      </div>

      <div className="rounded-md border bg-background/40 p-3">
        <div className="flex gap-2">
          <div className="grid shrink-0 grid-rows-7 gap-[3px] self-start pt-5">
            {HEATMAP_DAY_LABELS.map((label, row) => (
              <span
                key={row}
                className="h-[11px] text-[10px] leading-[11px] text-muted-foreground"
              >
                {label}
              </span>
            ))}
          </div>
          <div
            ref={scrollRef}
            className="rail-scroll min-w-0 flex-1 overflow-x-auto pb-2"
          >
            <div
              className="relative"
              style={{ width: NUM_WEEKS * CELL_PITCH - 3 }}
              onPointerLeave={() => setHovered(null)}
            >
              <div className="relative h-5">
                {visibleMonths.map((month) => (
                  <span
                    key={`${month.label}-${month.col}`}
                    className="absolute text-[10px] font-medium text-muted-foreground"
                    style={{ left: month.col * CELL_PITCH }}
                  >
                    {month.label}
                  </span>
                ))}
              </div>
              <div
                role="img"
                aria-label={`${formatPlaytime(yearSeconds)} played in the last year`}
                className="grid grid-flow-col grid-rows-7 gap-[3px]"
              >
                {weeks.flat().map((day) => (
                  <div
                    key={day.date}
                    onPointerEnter={() => !day.future && setHovered(day)}
                    className={cn(
                      "size-[11px] rounded-[2px]",
                      day.future
                        ? "invisible"
                        : LEVEL_COLORS[heatmapLevel(day.seconds)],
                      hovered?.date === day.date && "ring-1 ring-(--role)",
                    )}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span className="tabular-nums text-foreground/80">
            {hovered
              ? dayLabel(hovered)
              : `${formatPlaytime(yearSeconds)} in the last year`}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {LEVEL_COLORS.map((color, index) => (
              <span key={color} className="flex items-center gap-1">
                <span className={cn("size-[11px] rounded-[2px]", color)} />
                {HEATMAP_LEVEL_LABELS[index]}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
