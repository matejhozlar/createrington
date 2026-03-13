import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export function PriceChart({ symbol }: PriceChartProps) {
  const [interval, setInterval] = useState<Interval>("tick");

  const { data, isLoading } = trpc.public.crypto.priceHistory.useQuery(
    { symbol, interval, limit: 200 },
    {
      refetchInterval: interval === "tick" ? 60_000 : 3 * 60_000,
      refetchOnWindowFocus: false,
    },
  );

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">Price History</CardTitle>
        <div className="flex gap-0.5 rounded-lg border bg-card p-0.5">
          {INTERVALS.map((i) => (
            <button
              key={i.key}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-all",
                interval === i.key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setInterval(i.key)}
            >
              {i.label}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex h-[350px] items-center justify-center">
            <Loading mode="inline" size="small" />
          </div>
        ) : !data || data.length === 0 ? (
          <div className="flex h-[350px] items-center justify-center text-sm text-muted-foreground">
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

function CandlestickChart({ data }: { data: ChartDataPoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);

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
        vertLines: { color: "rgba(255, 255, 255, 0.03)" },
        horzLines: { color: "rgba(255, 255, 255, 0.03)" },
      },
      crosshair: {
        vertLine: { color: "rgba(255, 255, 255, 0.15)", style: 2 },
        horzLine: { color: "rgba(255, 255, 255, 0.15)", style: 2 },
      },
      rightPriceScale: {
        borderColor: "rgba(255, 255, 255, 0.06)",
      },
      timeScale: {
        borderColor: "rgba(255, 255, 255, 0.06)",
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 0,
      },
      handleScroll: false,
      handleScale: false,
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#34d399",
      downColor: "#f87171",
      borderUpColor: "#34d399",
      borderDownColor: "#f87171",
      wickUpColor: "#34d399",
      wickDownColor: "#f87171",
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
      lastValueVisible: false,
    });

    chart.priceScale("volume").applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
      visible: false,
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
          ? "rgba(52, 211, 153, 0.25)"
          : "rgba(248, 113, 113, 0.25)",
    }));

    candleSeriesRef.current.setData(candleData);
    volumeSeriesRef.current.setData(volumeData);
    chartRef.current?.timeScale().fitContent();
  }, [data]);

  if (data.length < 2) {
    return (
      <div className="flex h-[350px] items-center justify-center text-sm text-muted-foreground">
        Not enough data points
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-[350px] w-full [&_a[href]]:!hidden" />
  );
}
