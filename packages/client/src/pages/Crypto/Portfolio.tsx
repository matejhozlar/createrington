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
import { ArrowLeft, Wallet, BarChart3, TrendingUp, TrendingDown } from "lucide-react";
import { PortfolioChart } from "./components/PortfolioChart";
import { PriceAlerts } from "./components/PriceAlerts";

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
    return <Loading mode="inline" size="large" text="Loading portfolio..." className="py-12" />;
  }

  if (!data) return null;

  const pnlIsPositive = Number(data.unrealizedPnl) >= 0;
  const realizedPnl = Number(data.realizedPnl ?? 0);
  const realizedPnlPositive = realizedPnl >= 0;

  const stats = [
    {
      icon: Wallet,
      label: "Total Value",
      value: `$${Number(data.totalValue).toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
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
        <div className="relative px-5 md:px-8 pt-6 pb-6">
          <div className="max-w-7xl mx-auto space-y-4">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 -ml-2 text-muted-foreground hover:text-foreground"
              onClick={() => navigate("/crypto")}
            >
              <ArrowLeft className="size-4" />
              Back to Market
            </Button>

            <div className="flex items-center gap-3.5">
              <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
                <Wallet className="size-5 text-primary" />
              </div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                Portfolio
              </h1>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {stats.map((stat) => {
                const Icon = stat.icon;
                return (
                  <div key={stat.label} className="rounded-xl border bg-card/50 px-4 py-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        className={cn(
                          "flex size-7 items-center justify-center rounded-lg",
                          stat.iconBg,
                        )}
                      >
                        <Icon className={cn("size-3.5", stat.iconColor)} />
                      </div>
                      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                        {stat.label}
                      </p>
                    </div>
                    <p
                      className={cn(
                        "text-xl font-bold font-mono tabular-nums",
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
          </div>
        </div>
      </div>

      <div className="px-5 md:px-8 pt-6">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
            <PortfolioChart />
            <PriceAlerts />
          </div>

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
                      return (
                        <TableRow
                          key={h.tokenId}
                          className="cursor-pointer hover:bg-muted/30"
                          onClick={() => navigate(`/crypto/${h.symbol}`)}
                        >
                          <TableCell>
                            <div>
                              <p className="font-medium">{h.name}</p>
                              <p className="text-xs text-muted-foreground font-mono">
                                {h.symbol}
                              </p>
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
                            {Number(h.unrealizedPnl).toFixed(2)} ({h.unrealizedPnlPercent}%)
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
