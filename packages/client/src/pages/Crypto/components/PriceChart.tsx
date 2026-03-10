import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loading } from "@/components/loading-spinner";
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type HistogramData,
  ColorType,
  type Time,
  CandlestickSeries,
  HistogramSeries,
} from "lightweight-charts";

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

/** Displays an OHLCV price chart with interval selection for a given crypto symbol. */
export function PriceChart({ symbol }: PriceChartProps) {
  const [interval, setInterval] = useState<Interval>("minute");

  const { data, isLoading } = trpc.public.crypto.priceHistory.useQuery(
    { symbol, interval, limit: 200 },
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
          <div className="flex h-[300px] items-center justify-center">
            <Loading mode="inline" size="small" />
          </div>
        ) : !data || data.length === 0 ? (
          <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
            No price data available yet
          </div>
        ) : (
          <CandlestickChart data={data} />
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

/** Renders a lightweight-charts candlestick + volume overlay, auto-resizing to its container. */
function CandlestickChart({ data }: { data: ChartDataPoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);

  // Create chart on mount
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#a1a1aa",
        fontFamily: "ui-monospace, monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(255, 255, 255, 0.04)" },
        horzLines: { color: "rgba(255, 255, 255, 0.04)" },
      },
      crosshair: {
        vertLine: { color: "rgba(255, 255, 255, 0.2)" },
        horzLine: { color: "rgba(255, 255, 255, 0.2)" },
      },
      rightPriceScale: {
        borderColor: "rgba(255, 255, 255, 0.1)",
      },
      timeScale: {
        borderColor: "rgba(255, 255, 255, 0.1)",
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: { vertTouchDrag: false },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderUpColor: "#22c55e",
      borderDownColor: "#ef4444",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });

    // Confine volume bars to the bottom 20% of the chart so they don't obscure candles
    chart.priceScale("volume").applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        chart.applyOptions({ width });
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, []);

  // Update data when it changes
  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current || data.length < 2)
      return;

    const candleData: CandlestickData<Time>[] = data.map((d) => ({
      time: d.time as Time,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }));

    const volumeData: HistogramData<Time>[] = data.map((d) => ({
      time: d.time as Time,
      value: d.volume,
      color:
        d.close >= d.open
          ? "rgba(34, 197, 94, 0.3)"
          : "rgba(239, 68, 68, 0.3)",
    }));

    candleSeriesRef.current.setData(candleData);
    volumeSeriesRef.current.setData(volumeData);
    chartRef.current?.timeScale().fitContent();
  }, [data]);

  if (data.length < 2) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
        Not enough data points
      </div>
    );
  }

  return <div ref={containerRef} className="h-[300px] w-full" />;
}
