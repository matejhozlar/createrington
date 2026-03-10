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

export function PortfolioChart() {
  const { user } = useAuth();
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);

  const { data } = trpc.user.crypto.portfolioHistory.useQuery(
    { limit: 90 },
    { enabled: !!user },
  );

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
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
      rightPriceScale: {
        borderColor: "rgba(255, 255, 255, 0.06)",
      },
      timeScale: {
        borderColor: "rgba(255, 255, 255, 0.06)",
        timeVisible: false,
      },
      crosshair: {
        vertLine: { color: "rgba(255, 255, 255, 0.15)", style: 2 },
        horzLine: { color: "rgba(255, 255, 255, 0.15)", style: 2 },
      },
      handleScroll: { vertTouchDrag: false },
      width: chartContainerRef.current.clientWidth,
      height: 280,
    });

    const series = chart.addSeries(AreaSeries, {
      lineColor: "#34d399",
      topColor: "rgba(52, 211, 153, 0.25)",
      bottomColor: "rgba(52, 211, 153, 0.01)",
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

  useEffect(() => {
    if (!seriesRef.current || !data || data.length === 0) return;

    const areaData: AreaData<Time>[] = data.map((d) => ({
      time: (Math.floor(new Date(d.recordedAt).getTime() / 1000) as unknown) as Time,
      value: Number(d.totalValue),
    }));

    seriesRef.current.setData(areaData);
    chartRef.current?.timeScale().fitContent();
  }, [data]);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Portfolio Value</CardTitle>
      </CardHeader>
      <CardContent>
        {!user ? (
          <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
            Sign in to view your portfolio history
          </div>
        ) : !data || data.length === 0 ? (
          <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
            No portfolio data available yet
          </div>
        ) : (
          <div ref={chartContainerRef} className="h-[280px] w-full" />
        )}
      </CardContent>
    </Card>
  );
}
