import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface ActivityDataPoint {
  date: string;
  uniquePlayers: number;
  totalHours: number;
}

interface ActivityChartProps {
  data: ActivityDataPoint[];
}

export function ActivityChart({ data }: ActivityChartProps) {
  const formatted = data.map((d) => ({
    ...d,
    date: new Date(d.date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    totalHours: Math.round(d.totalHours * 10) / 10,
  }));

  return (
    <ResponsiveContainer width="100%" height={350}>
      <AreaChart data={formatted}>
        <defs>
          <linearGradient id="colorPlayers" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="5%"
              stopColor="oklch(0.65 0.15 250)"
              stopOpacity={0.3}
            />
            <stop
              offset="95%"
              stopColor="oklch(0.65 0.15 250)"
              stopOpacity={0}
            />
          </linearGradient>
          <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="5%"
              stopColor="oklch(0.7 0.15 150)"
              stopOpacity={0.3}
            />
            <stop
              offset="95%"
              stopColor="oklch(0.7 0.15 150)"
              stopOpacity={0}
            />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="oklch(0.3 0 0)"
          vertical={false}
        />
        <XAxis
          dataKey="date"
          tick={{ fill: "oklch(0.55 0 0)", fontSize: 12 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          yAxisId="players"
          tick={{ fill: "oklch(0.55 0 0)", fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <YAxis
          yAxisId="hours"
          orientation="right"
          tick={{ fill: "oklch(0.55 0 0)", fontSize: 12 }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "oklch(0.2 0 0)",
            border: "1px solid oklch(0.3 0 0)",
            borderRadius: "8px",
            color: "oklch(0.9 0 0)",
          }}
        />
        <Legend />
        <Area
          yAxisId="players"
          type="monotone"
          dataKey="uniquePlayers"
          name="Unique Players"
          stroke="oklch(0.65 0.15 250)"
          fill="url(#colorPlayers)"
          strokeWidth={2}
        />
        <Area
          yAxisId="hours"
          type="monotone"
          dataKey="totalHours"
          name="Total Hours"
          stroke="oklch(0.7 0.15 150)"
          fill="url(#colorHours)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
