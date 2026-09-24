export interface HeatmapDay {
  date: string;
  seconds: number;
  future: boolean;
}

export interface HeatmapGrid {
  weeks: HeatmapDay[][];
  monthLabels: { label: string; col: number }[];
}

export const HEATMAP_LEVEL_LABELS = ["None", "<1h", "1-2h", "2-4h", "4h+"];

export const HEATMAP_DAY_LABELS = ["Mon", "", "Wed", "", "Fri", "", "Sun"];

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

export function heatmapLevel(seconds: number): number {
  if (seconds <= 0) return 0;
  if (seconds < 3600) return 1;
  if (seconds < 7200) return 2;
  if (seconds < 14400) return 3;
  return 4;
}

function toDateStr(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseHeatmapDate(date: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function buildHeatmapGrid(
  days: Record<string, number>,
  numWeeks: number,
): HeatmapGrid {
  const today = new Date();
  const todayDay = today.getDay();
  const mondayOffset = todayDay === 0 ? 6 : todayDay - 1;

  const start = new Date(today);
  start.setDate(start.getDate() - mondayOffset - (numWeeks - 1) * 7);

  const weeks: HeatmapDay[][] = [];
  const monthLabels: { label: string; col: number }[] = [];
  let lastMonth = -1;

  const cursor = new Date(start);
  for (let col = 0; col < numWeeks; col++) {
    const week: HeatmapDay[] = [];
    for (let row = 0; row < 7; row++) {
      const dateStr = toDateStr(cursor);
      const isFuture = cursor > today;
      week.push({
        date: dateStr,
        seconds: isFuture ? 0 : (days[dateStr] ?? 0),
        future: isFuture,
      });

      if (row === 0) {
        const month = cursor.getMonth();
        if (month !== lastMonth) {
          monthLabels.push({ label: MONTH_LABELS[month], col });
          lastMonth = month;
        }
      }

      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }

  return { weeks, monthLabels };
}
