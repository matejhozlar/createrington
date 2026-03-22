import { useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/contexts/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  createChart,
  type AreaData,
  type Time,
  ColorType,
  AreaSeries,
} from "lightweight-charts";

export function PortfolioChart() {
  const { user } = useAuth();
  const chartContainerRef = useRef<HTMLDivElement>(null);

  const { data } = trpc.user.crypto.portfolioHistory.useQuery(
    { limit: 90 },
    { enabled: !!user },
  );

  const { data: portfolio } = trpc.user.crypto.portfolio.useQuery(undefined, {
    enabled: !!user,
  });

  useEffect(() => {
    if (!chartContainerRef.current || !data || data.length === 0) return;

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
        rightOffset: 0,
      },
      crosshair: {
        vertLine: { color: "rgba(255, 255, 255, 0.15)", style: 2 },
        horzLine: { color: "rgba(255, 255, 255, 0.15)", style: 2 },
      },
      handleScroll: false,
      handleScale: false,
      width: chartContainerRef.current.clientWidth,
      height: 280,
    });

    const series = chart.addSeries(AreaSeries, {
      lineColor: "#34d399",
      topColor: "rgba(52, 211, 153, 0.25)",
      bottomColor: "rgba(52, 211, 153, 0.01)",
      lineWidth: 2,
    });

    const areaData: AreaData<Time>[] = data
      .filter((d) => d.totalValue != null && !isNaN(Number(d.totalValue)))
      .map((d) => ({
        time: Math.floor(
          new Date(d.recordedAt).getTime() / 1000,
        ) as unknown as Time,
        value: Number(d.totalValue),
      }));

    // Append current portfolio value as today's data point
    if (portfolio && portfolio.totalValue != null && !isNaN(Number(portfolio.totalValue))) {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const todayTs = Math.floor(now.getTime() / 1000) as unknown as Time;
      const lastPoint = areaData[areaData.length - 1];

      if (!lastPoint || lastPoint.time !== todayTs) {
        areaData.push({ time: todayTs, value: Number(portfolio.totalValue) });
      } else {
        lastPoint.value = Number(portfolio.totalValue);
      }
    }

    series.setData(areaData);
    chart.timeScale().fitContent();

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
    };
  }, [data, portfolio]);

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
          <div
            ref={chartContainerRef}
            className="h-[280px] w-full [&_a[href]]:!hidden"
          />
        )}
      </CardContent>
    </Card>
  );
}
