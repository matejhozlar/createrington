import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loading } from "@/components/loading-spinner";

interface PriceChartProps {
  symbol: string;
}

type Interval = "tick" | "minute" | "hourly" | "daily";

const INTERVALS: { key: Interval; label: string }[] = [
  { key: "tick", label: "Live" },
  { key: "minute", label: "1m" },
  { key: "hourly", label: "1h" },
  { key: "daily", label: "1d" },
];

export function PriceChart({ symbol }: PriceChartProps) {
  const [interval, setInterval] = useState<Interval>("minute");

  const { data, isLoading } = trpc.public.crypto.priceHistory.useQuery(
    { symbol, interval, limit: 100 },
    { refetchInterval: interval === "tick" ? 30_000 : 60_000 },
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">Price History</CardTitle>
        <div className="flex gap-1">
          {INTERVALS.map((i) => (
            <Button
              key={i.key}
              variant={interval === i.key ? "default" : "ghost"}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setInterval(i.key)}
            >
              {i.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex h-[200px] items-center justify-center">
            <Loading mode="inline" size="small" />
          </div>
        ) : !data || data.length === 0 ? (
          <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
            No price data available yet
          </div>
        ) : (
          <SimpleLineChart data={data} />
        )}
      </CardContent>
    </Card>
  );
}

interface ChartDataPoint {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

function SimpleLineChart({ data }: { data: ChartDataPoint[] }) {
  if (data.length < 2) {
    return (
      <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
        Not enough data points
      </div>
    );
  }

  const prices = data.map((d) => d.close);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice || 1;

  const height = 200;
  const width = 100; // percentage-based
  const padding = 8;

  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * width;
    const y =
      height - padding - ((d.close - minPrice) / priceRange) * (height - padding * 2);
    return `${x},${y}`;
  });

  const firstPrice = prices[0];
  const lastPrice = prices[prices.length - 1];
  const isUp = lastPrice >= firstPrice;

  return (
    <div className="space-y-2">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-[200px] w-full"
        preserveAspectRatio="none"
      >
        <polyline
          points={points.join(" ")}
          fill="none"
          stroke={isUp ? "#22c55e" : "#ef4444"}
          strokeWidth="0.5"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="flex justify-between text-xs text-muted-foreground font-mono">
        <span>Low: ${minPrice.toFixed(4)}</span>
        <span>High: ${maxPrice.toFixed(4)}</span>
      </div>
    </div>
  );
}
