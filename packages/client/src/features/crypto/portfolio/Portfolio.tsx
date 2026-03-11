import { useNavigate } from "react-router-dom";
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
import { PortfolioChart } from "./components/PortfolioChart";
import { PriceAlerts } from "./components/PriceAlerts";

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

const ALLOCATION_TEXT_COLORS = [
  "text-emerald-400",
  "text-blue-400",
  "text-purple-400",
  "text-amber-400",
  "text-rose-400",
  "text-cyan-400",
  "text-orange-400",
  "text-pink-400",
  "text-teal-400",
  "text-indigo-400",
];

export function Portfolio() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data, isLoading } = trpc.user.crypto.portfolio.useQuery(undefined, {
    enabled: !!user,
    refetchInterval: 30_000,
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

  // Compute allocation percentages for the bar
  const allocations = data.holdings
    .map((h, i) => ({
      name: h.name,
      symbol: h.symbol,
      value: Number(h.currentValue),
      percent: totalValue > 0 ? (Number(h.currentValue) / totalValue) * 100 : 0,
      color: ALLOCATION_COLORS[i % ALLOCATION_COLORS.length],
      textColor: ALLOCATION_TEXT_COLORS[i % ALLOCATION_TEXT_COLORS.length],
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
      iconBg: pnlIsPositive ? "bg-emerald-500/10" : "bg-red-500/10",
      iconColor: pnlIsPositive ? "text-emerald-400" : "text-red-400",
      valueColor: pnlIsPositive ? "text-emerald-400" : "text-red-400",
    },
    {
      icon: realizedPnlPositive ? TrendingUp : TrendingDown,
      label: "Realized P&L",
      value: `${realizedPnlPositive ? "+" : ""}$${realizedPnl.toFixed(2)}`,
      iconBg: realizedPnlPositive ? "bg-emerald-500/10" : "bg-red-500/10",
      iconColor: realizedPnlPositive ? "text-emerald-400" : "text-red-400",
      valueColor: realizedPnlPositive ? "text-emerald-400" : "text-red-400",
    },
  ];

  return (
    <div className="flex flex-1 flex-col pb-16">
      {/* Header */}
      <div className="relative overflow-hidden border-b border-border/50">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] via-transparent to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
        <div className="relative px-5 md:px-8 pt-5 pb-5">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center gap-3.5">
              <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
                <Wallet className="size-5 text-primary" />
              </div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                Portfolio
              </h1>
            </div>
          </div>
        </div>
      </div>

      <div className="px-5 md:px-8 pt-5">
        <div className="max-w-7xl mx-auto space-y-5">
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

          {/* Allocation bar */}
          {allocations.length > 0 && totalValue > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Allocation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Stacked bar */}
                <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted/20">
                  {allocations.map((a) => (
                    <div
                      key={a.symbol}
                      className={cn(
                        "h-full transition-all duration-500",
                        a.color,
                      )}
                      style={{ width: `${Math.max(a.percent, 0.5)}%` }}
                      title={`${a.name}: ${a.percent.toFixed(1)}%`}
                    />
                  ))}
                </div>
                {/* Legend */}
                <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                  {allocations.slice(0, 8).map((a) => (
                    <div key={a.symbol} className="flex items-center gap-1.5">
                      <span className={cn("size-2 rounded-full", a.color)} />
                      <span className="text-xs text-muted-foreground">
                        {a.symbol}
                      </span>
                      <span
                        className={cn(
                          "text-xs font-mono font-medium tabular-nums",
                          a.textColor,
                        )}
                      >
                        {a.percent.toFixed(1)}%
                      </span>
                    </div>
                  ))}
                  {allocations.length > 8 && (
                    <span className="text-xs text-muted-foreground">
                      +{allocations.length - 8} more
                    </span>
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
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Token</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Avg Buy</TableHead>
                      <TableHead className="text-right">Current</TableHead>
                      <TableHead className="text-right">Value</TableHead>
                      <TableHead className="text-right">P&L</TableHead>
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
                              pnlPositive ? "text-emerald-400" : "text-red-400",
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
    </div>
  );
}
