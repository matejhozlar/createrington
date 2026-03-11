import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { PieChart as PieChartIcon, Users } from "lucide-react";
import { MinecraftAvatar } from "@/components/minecraft-avatar";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Sector,
  Tooltip,
  type PieSectorDataItem,
} from "recharts";

const COLORS = [
  "#34d399", // emerald
  "#60a5fa", // blue
  "#a78bfa", // purple
  "#fbbf24", // amber
  "#fb7185", // rose
  "#22d3ee", // cyan
  "#fb923c", // orange
  "#f472b6", // pink
  "#2dd4bf", // teal
  "#818cf8", // indigo
];

interface TokenDistributionProps {
  symbol: string;
}

interface ChartEntry {
  name: string;
  value: number;
  percentage: number;
  fill: string;
  isUnclaimed?: boolean;
}

export function TokenDistribution({ symbol }: TokenDistributionProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const { data, isLoading } = trpc.public.crypto.tokenDistribution.useQuery(
    { symbol },
    { refetchInterval: 60_000 },
  );

  const onPieEnter = useCallback((_: unknown, index: number) => {
    setActiveIndex(index);
  }, []);

  const onPieLeave = useCallback(() => {
    setActiveIndex(null);
  }, []);

  if (isLoading || !data) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <PieChartIcon className="size-4" />
            Ownership Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[320px] animate-pulse rounded-lg bg-muted" />
        </CardContent>
      </Card>
    );
  }

  const totalSupply = Number(data.totalSupply);
  const availableSupply = Number(data.availableSupply);
  const circulatingSupply = totalSupply - availableSupply;
  const unclaimedPercent =
    totalSupply > 0 ? (availableSupply / totalSupply) * 100 : 0;

  const chartData: ChartEntry[] = data.holders.map((h, i) => ({
    name: h.playerName,
    value: Number(h.amount),
    percentage: h.percentage,
    fill: COLORS[i % COLORS.length],
  }));

  if (unclaimedPercent > 0) {
    chartData.push({
      name: "Unclaimed",
      value: availableSupply,
      percentage: Math.round(unclaimedPercent * 10) / 10,
      fill: "rgba(161, 161, 170, 0.2)",
      isUnclaimed: true,
    });
  }

  const activeEntry = activeIndex !== null ? chartData[activeIndex] : null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <PieChartIcon className="size-4" />
            Ownership Distribution
          </CardTitle>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="size-3.5" />
            <span className="font-mono tabular-nums">{data.holderCount}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Donut chart */}
        <div className="relative">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={2}
                dataKey="value"
                strokeWidth={0}
                shape={(
                  props: PieSectorDataItem & {
                    isActive: boolean;
                    index?: number;
                  },
                ) => {
                  const { isActive, index: idx, ...rest } = props;
                  const dimmed =
                    activeIndex !== null && activeIndex !== (idx ?? 0);

                  if (isActive) {
                    return (
                      <Sector
                        {...rest}
                        innerRadius={(rest.innerRadius ?? 60) - 3}
                        outerRadius={(rest.outerRadius ?? 90) + 6}
                        cornerRadius={3}
                      />
                    );
                  }

                  return (
                    <Sector
                      {...rest}
                      opacity={dimmed ? 0.4 : 1}
                      style={{ cursor: "pointer", transition: "opacity 0.2s" }}
                    />
                  );
                }}
                onMouseEnter={onPieEnter}
                onMouseLeave={onPieLeave}
              >
                {chartData.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
            </PieChart>
          </ResponsiveContainer>

          {/* Center label */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              {activeEntry ? (
                <>
                  <p className="text-lg font-bold font-mono tabular-nums leading-tight">
                    {activeEntry.percentage.toFixed(1)}%
                  </p>
                  <p className="text-[11px] text-muted-foreground max-w-[90px] truncate">
                    {activeEntry.name}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-lg font-bold font-mono tabular-nums leading-tight">
                    {circulatingSupply.toLocaleString()}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    circulating
                  </p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="space-y-1">
          {data.holders.slice(0, 10).map((h, i) => (
            <div
              key={h.playerName}
              className={cn(
                "flex items-center justify-between rounded-md px-2 py-1 text-xs transition-colors cursor-default",
                activeIndex === i ? "bg-muted/60" : "hover:bg-muted/30",
              )}
              onMouseEnter={() => setActiveIndex(i)}
              onMouseLeave={() => setActiveIndex(null)}
            >
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="size-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: COLORS[i % COLORS.length] }}
                />
                <MinecraftAvatar
                  username={h.playerName}
                  uuid={h.playerUuid}
                  size={18}
                />
                <span className="text-muted-foreground truncate">
                  {h.playerName}
                </span>
              </div>
              <div className="flex gap-3 font-mono tabular-nums shrink-0">
                <span>{Number(h.amount).toLocaleString()}</span>
                <span className="text-muted-foreground w-12 text-right">
                  {h.percentage.toFixed(1)}%
                </span>
              </div>
            </div>
          ))}
          {unclaimedPercent > 0 && (
            <div
              className={cn(
                "flex items-center justify-between rounded-md px-2 py-1 text-xs transition-colors cursor-default",
                activeIndex === chartData.length - 1
                  ? "bg-muted/60"
                  : "hover:bg-muted/30",
              )}
              onMouseEnter={() => setActiveIndex(chartData.length - 1)}
              onMouseLeave={() => setActiveIndex(null)}
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="size-2.5 rounded-full shrink-0 bg-muted-foreground/20 ring-1 ring-muted-foreground/10" />
                <span className="text-muted-foreground truncate">
                  Unclaimed
                </span>
              </div>
              <div className="flex gap-3 font-mono tabular-nums shrink-0">
                <span>{availableSupply.toLocaleString()}</span>
                <span className="text-muted-foreground w-12 text-right">
                  {unclaimedPercent.toFixed(1)}%
                </span>
              </div>
            </div>
          )}
          {data.holders.length > 10 && (
            <p className="text-[11px] text-muted-foreground text-center pt-1">
              +{data.holders.length - 10} more holders
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartEntry }>;
}) {
  if (!active || !payload?.length) return null;

  const entry = payload[0].payload;

  return (
    <div className="rounded-lg border bg-popover/95 backdrop-blur-sm px-3 py-2 shadow-xl">
      <div className="flex items-center gap-2">
        <div
          className="size-2.5 rounded-full"
          style={{ backgroundColor: entry.fill }}
        />
        <span className="text-sm font-medium">{entry.name}</span>
      </div>
      <div className="mt-1 flex items-baseline gap-2 text-xs text-muted-foreground">
        <span className="font-mono tabular-nums font-medium text-foreground">
          {entry.value.toLocaleString()}
        </span>
        <span>({entry.percentage.toFixed(1)}%)</span>
      </div>
    </div>
  );
}
