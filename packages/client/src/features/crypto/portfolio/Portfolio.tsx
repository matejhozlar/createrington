import { useState, useCallback } from "react";
import { useNavigate } from "react-router";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth";
import { Loading } from "@/components/loading-spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Wallet, BarChart3, TrendingUp, TrendingDown } from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Sector,
  type PieSectorDataItem,
} from "recharts";
import { PortfolioChart } from "./components/PortfolioChart";
import { PriceAlerts } from "./components/PriceAlerts";

const ALLOCATION_FILLS = [
  "#34d399", // emerald-400
  "#60a5fa", // blue-400
  "#c084fc", // purple-400
  "#fbbf24", // amber-400
  "#fb7185", // rose-400
  "#22d3ee", // cyan-400
  "#fb923c", // orange-400
  "#f472b6", // pink-400
  "#2dd4bf", // teal-400
  "#818cf8", // indigo-400
];

const ALLOCATION_COLORS = [
  "bg-emerald-400",
  "bg-blue-400",
  "bg-purple-400",
  "bg-amber-400",
  "bg-rose-400",
  "bg-cyan-400",
  "bg-orange-400",
  "bg-pink-400",
  "bg-teal-400",
  "bg-indigo-400",
];

export function Portfolio() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const onPieEnter = useCallback((_: unknown, index: number) => {
    setActiveIndex(index);
  }, []);

  const onPieLeave = useCallback(() => {
    setActiveIndex(null);
  }, []);

  const { data, isLoading } = trpc.user.crypto.portfolio.useQuery(undefined, {
    enabled: !!user,
  });

  if (!user) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        Sign in to view your portfolio
      </div>
    );
  }

  if (isLoading) {
    return (
      <Loading
        mode="inline"
        size="large"
        text="Loading portfolio..."
        className="py-12"
      />
    );
  }

  if (!data) return null;

  const pnlIsPositive = Number(data.unrealizedPnl) >= 0;
  const realizedPnl = Number(data.realizedPnl ?? 0);
  const realizedPnlPositive = realizedPnl >= 0;
  const totalValue = Number(data.totalValue);

  const allocations = data.holdings
    .map((h, i) => ({
      name: h.name,
      symbol: h.symbol,
      value: Number(h.currentValue),
      percent: totalValue > 0 ? (Number(h.currentValue) / totalValue) * 100 : 0,
      fill: ALLOCATION_FILLS[i % ALLOCATION_FILLS.length],
      color: ALLOCATION_COLORS[i % ALLOCATION_COLORS.length],
    }))
    .sort((a, b) => b.value - a.value);

  const stats = [
    {
      icon: Wallet,
      label: "Total Value",
      value: `$${totalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
      iconBg: "bg-primary/10",
      iconColor: "text-primary",
    },
    {
      icon: BarChart3,
      label: "Total Invested",
      value: `$${Number(data.totalInvested).toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
      iconBg: "bg-blue-500/10",
      iconColor: "text-blue-400",
    },
    {
      icon: pnlIsPositive ? TrendingUp : TrendingDown,
      label: "Unrealized P&L",
      value: `${pnlIsPositive ? "+" : ""}$${Number(data.unrealizedPnl).toFixed(2)}`,
      sub: `${data.unrealizedPnlPercent}%`,
      iconBg: pnlIsPositive ? "bg-emerald-500/10" : "bg-destructive/10",
      iconColor: pnlIsPositive ? "text-emerald-400" : "text-destructive",
      valueColor: pnlIsPositive ? "text-emerald-400" : "text-destructive",
    },
    {
      icon: realizedPnlPositive ? TrendingUp : TrendingDown,
      label: "Realized P&L",
      value: `${realizedPnlPositive ? "+" : ""}$${realizedPnl.toFixed(2)}`,
      iconBg: realizedPnlPositive ? "bg-emerald-500/10" : "bg-destructive/10",
      iconColor: realizedPnlPositive ? "text-emerald-400" : "text-destructive",
      valueColor: realizedPnlPositive ? "text-emerald-400" : "text-destructive",
    },
  ];

  return (
    <div className="flex flex-1 flex-col px-5 md:px-8 pt-5 pb-16">
      <div className="max-w-7xl mx-auto w-full space-y-5">
        <div className="flex items-baseline justify-between">
          <h1 className="text-xl font-bold tracking-tight">Portfolio</h1>
        </div>
        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px rounded-xl border bg-border/50 overflow-hidden">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="bg-card/70 px-4 py-2.5">
                <div className="flex items-center gap-2 mb-1.5">
                  <div
                    className={cn(
                      "flex size-7 items-center justify-center rounded-lg",
                      stat.iconBg,
                    )}
                  >
                    <Icon className={cn("size-3.5", stat.iconColor)} />
                  </div>
                  <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                    {stat.label}
                  </p>
                </div>
                <p
                  className={cn(
                    "text-lg font-bold font-mono tabular-nums",
                    stat.valueColor,
                  )}
                >
                  {stat.value}
                  {stat.sub && (
                    <span className="text-sm ml-1.5 font-medium">
                      ({stat.sub})
                    </span>
                  )}
                </p>
              </div>
            );
          })}
        </div>
        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
          <PortfolioChart />
          <PriceAlerts />
        </div>

        {/* Allocation donut */}
        {allocations.length > 0 && totalValue > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Allocation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Donut chart */}
              <div className="relative">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={allocations}
                      dataKey="value"
                      nameKey="symbol"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
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
                            style={{
                              cursor: "pointer",
                              transition: "opacity 0.2s",
                            }}
                          />
                        );
                      }}
                      onMouseEnter={onPieEnter}
                      onMouseLeave={onPieLeave}
                    >
                      {allocations.map((a) => (
                        <Cell key={a.symbol} fill={a.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.[0]) return null;
                        const d = payload[0].payload;
                        return (
                          <div className="rounded-lg border bg-popover/95 backdrop-blur-sm px-3 py-2 shadow-xl">
                            <div className="flex items-center gap-2">
                              <div
                                className="size-2.5 rounded-full"
                                style={{ backgroundColor: d.fill }}
                              />
                              <span className="text-sm font-medium">
                                {d.name}
                              </span>
                            </div>
                            <div className="mt-1 flex items-baseline gap-2 text-xs text-muted-foreground">
                              <span className="font-mono tabular-nums font-medium text-foreground">
                                ${d.value.toFixed(2)}
                              </span>
                              <span>({d.percent.toFixed(1)}%)</span>
                            </div>
                          </div>
                        );
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>

                {/* Center label */}
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    {activeIndex !== null && allocations[activeIndex] ? (
                      <>
                        <p className="text-lg font-bold font-mono tabular-nums leading-tight">
                          {allocations[activeIndex].percent.toFixed(1)}%
                        </p>
                        <p className="text-[11px] text-muted-foreground max-w-[90px] truncate">
                          {allocations[activeIndex].symbol}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-lg font-bold font-mono tabular-nums leading-tight">
                          {data.tokenCount}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          tokens
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Legend */}
              <div className="space-y-1">
                {allocations.slice(0, 10).map((a, i) => (
                  <div
                    key={a.symbol}
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
                        style={{ backgroundColor: a.fill }}
                      />
                      <span
                        className="text-muted-foreground truncate"
                        title={a.name}
                      >
                        {a.name}
                      </span>
                      <span className="text-muted-foreground font-mono">
                        {a.symbol}
                      </span>
                    </div>
                    <div className="flex gap-3 font-mono tabular-nums shrink-0">
                      <span>${a.value.toFixed(2)}</span>
                      <span className="text-muted-foreground w-12 text-right">
                        {a.percent.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ))}
                {allocations.length > 10 && (
                  <p className="text-[11px] text-muted-foreground text-center pt-1">
                    +{allocations.length - 10} more tokens
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {data.holdings.length > 0 ? (
          <Card className="overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Holdings ({data.tokenCount})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table className="min-w-[750px]">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Token</TableHead>
                    <TableHead col="amount" className="text-right">
                      Amount
                    </TableHead>
                    <TableHead col="amount" className="text-right">
                      Avg Buy
                    </TableHead>
                    <TableHead col="amount" className="text-right">
                      Current
                    </TableHead>
                    <TableHead col="amount" className="text-right">
                      Value
                    </TableHead>
                    <TableHead col="amount" className="text-right">
                      P&L
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.holdings.map((h) => {
                    const pnlPositive = Number(h.unrealizedPnl) >= 0;
                    const allocIdx = allocations.findIndex(
                      (a) => a.symbol === h.symbol,
                    );
                    const dotColor =
                      allocIdx >= 0
                        ? allocations[allocIdx].color
                        : ALLOCATION_COLORS[0];
                    return (
                      <TableRow
                        key={h.tokenId}
                        className="cursor-pointer hover:bg-muted/30"
                        onClick={() => navigate(`/crypto/${h.symbol}`)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <span
                              className={cn(
                                "size-2 rounded-full shrink-0",
                                dotColor,
                              )}
                            />
                            <div>
                              <p className="font-medium">{h.name}</p>
                              <p className="text-xs text-muted-foreground font-mono">
                                {h.symbol}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {Number(h.amount).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                          ${Number(h.avgBuyPrice).toFixed(4)}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          ${Number(h.currentPrice).toFixed(4)}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums font-medium">
                          ${Number(h.currentValue).toFixed(2)}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right font-mono tabular-nums font-medium",
                            pnlPositive
                              ? "text-emerald-400"
                              : "text-destructive",
                          )}
                        >
                          {pnlPositive ? "+" : ""}
                          {Number(h.unrealizedPnl).toFixed(2)} (
                          {h.unrealizedPnlPercent}%)
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : (
          <div className="py-12 text-center text-muted-foreground">
            <p>You don't have any holdings yet.</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => navigate("/crypto")}
            >
              Browse Tokens
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
