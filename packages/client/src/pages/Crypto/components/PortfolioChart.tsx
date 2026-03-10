import { useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/contexts/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  type AreaData,
  type Time,
  ColorType,
  AreaSeries,
} from "lightweight-charts";

/** Displays portfolio total value over time as an area chart. */
export function PortfolioChart() {
  const { user } = useAuth();
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);

  const { data } = trpc.user.crypto.portfolioHistory.useQuery(
    { limit: 90 },
    { enabled: !!user },
  );

  // Create chart on mount
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#0a0a0f" },
        textColor: "#888",
        fontFamily: "ui-monospace, monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(255, 255, 255, 0.05)" },
        horzLines: { color: "rgba(255, 255, 255, 0.05)" },
      },
      rightPriceScale: {
        borderColor: "rgba(255, 255, 255, 0.1)",
      },
      timeScale: {
        borderColor: "rgba(255, 255, 255, 0.1)",
        timeVisible: false,
      },
      crosshair: {
        vertLine: { color: "rgba(255, 255, 255, 0.2)" },
        horzLine: { color: "rgba(255, 255, 255, 0.2)" },
      },
      handleScroll: { vertTouchDrag: false },
      width: chartContainerRef.current.clientWidth,
      height: 250,
    });

    const series = chart.addSeries(AreaSeries, {
      lineColor: "#10b981",
      topColor: "rgba(16, 185, 129, 0.3)",
      bottomColor: "rgba(16, 185, 129, 0.02)",
      lineWidth: 2,
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        chart.applyOptions({ width });
      }
    });

    resizeObserver.observe(chartContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // Update data when it changes
  useEffect(() => {
    if (!seriesRef.current || !data || data.length === 0) return;

    // lightweight-charts expects Unix seconds as the Time type; the double cast satisfies TypeScript
    const areaData: AreaData<Time>[] = data.map((d) => ({
      time: (Math.floor(new Date(d.recordedAt).getTime() / 1000) as unknown) as Time,
      value: Number(d.totalValue),
    }));

    seriesRef.current.setData(areaData);
    chartRef.current?.timeScale().fitContent();
  }, [data]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Portfolio Value</CardTitle>
      </CardHeader>
      <CardContent>
        {!user ? (
          <div className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">
            Sign in to view your portfolio history
          </div>
        ) : !data || data.length === 0 ? (
          <div className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">
            No portfolio data available yet
          </div>
        ) : (
          <div ref={chartContainerRef} className="h-[250px] w-full" />
        )}
      </CardContent>
    </Card>
  );
}
