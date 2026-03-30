import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface HeatmapDataPoint {
  day: string;
  hour: number;
  uniquePlayers: number;
  totalSeconds: number;
}

interface HeatmapChartProps {
  data: HeatmapDataPoint[];
}

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function HeatmapChart({ data }: HeatmapChartProps) {
  const { grid, maxPlayers } = useMemo(() => {
    // Aggregate data by day-of-week and hour
    const buckets: Record<string, number> = {};
    let max = 0;

    for (const point of data) {
      const dayOfWeek = new Date(point.day).getUTCDay();
      const key = `${dayOfWeek}-${point.hour}`;
      buckets[key] = (buckets[key] || 0) + point.uniquePlayers;
    }

    for (const val of Object.values(buckets)) {
      if (val > max) max = val;
    }

    return { grid: buckets, maxPlayers: max };
  }, [data]);

  const getIntensity = (dayOfWeek: number, hour: number): number => {
    if (maxPlayers === 0) return 0;
    const key = `${dayOfWeek}-${hour}`;
    const value = grid[key] || 0;
    return value / maxPlayers;
  };

  const getColor = (intensity: number): string => {
    if (intensity === 0) return "bg-muted/50";
    if (intensity < 0.25) return "bg-green-500/20";
    if (intensity < 0.5) return "bg-green-500/40";
    if (intensity < 0.75) return "bg-green-500/60";
    return "bg-green-500/80";
  };

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[700px]">
        {/* Hour labels */}
        <div className="mb-1 flex gap-[2px] pl-10">
          {HOURS.map((hour) => (
            <div
              key={hour}
              className="flex-1 text-center text-[10px] text-muted-foreground"
            >
              {hour % 3 === 0 ? `${hour}:00` : ""}
            </div>
          ))}
        </div>

        {/* Grid rows */}
        {DAYS_OF_WEEK.map((dayName, dayIndex) => (
          <div key={dayName} className="flex items-center gap-[2px] mb-[2px]">
            <div className="w-10 text-right text-xs text-muted-foreground pr-2">
              {dayName}
            </div>
            {HOURS.map((hour) => {
              const intensity = getIntensity(dayIndex, hour);
              const value = grid[`${dayIndex}-${hour}`] || 0;

              return (
                <div
                  key={hour}
                  className={cn(
                    "flex-1 aspect-square rounded-sm transition-colors",
                    getColor(intensity),
                  )}
                  title={`${dayName} ${hour}:00 - ${value} players`}
                />
              );
            })}
          </div>
        ))}

        {/* Legend */}
        <div className="mt-3 flex items-center justify-end gap-1 text-xs text-muted-foreground">
          <span>Less</span>
          <div className="size-3 rounded-sm bg-muted/50" />
          <div className="size-3 rounded-sm bg-green-500/20" />
          <div className="size-3 rounded-sm bg-green-500/40" />
          <div className="size-3 rounded-sm bg-green-500/60" />
          <div className="size-3 rounded-sm bg-green-500/80" />
          <span>More</span>
        </div>
      </div>
    </div>
  );
}
