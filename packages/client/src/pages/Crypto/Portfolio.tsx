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
import { ArrowLeft } from "lucide-react";
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

  return (
    <div className="flex flex-1 flex-col pb-16">
      <div className="px-5 md:px-8 pt-6 pb-6">
        <div className="max-w-7xl mx-auto space-y-4">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 -ml-2"
            onClick={() => navigate("/crypto")}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Market
          </Button>

          <h1 className="text-3xl md:text-4xl font-semibold">Portfolio</h1>

          {/* Stats strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-lg border px-4 py-3">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Total Value
              </p>
              <p className="mt-1 text-xl font-semibold font-mono">
                ${Number(data.totalValue).toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </p>
            </div>

            <div className="rounded-lg border px-4 py-3">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Total Invested
              </p>
              <p className="mt-1 text-xl font-semibold font-mono">
                ${Number(data.totalInvested).toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </p>
            </div>

            <div className="rounded-lg border px-4 py-3">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Unrealized P&L
              </p>
              <p
                className={cn(
                  "mt-1 text-xl font-semibold font-mono",
                  pnlIsPositive ? "text-emerald-400" : "text-red-400",
                )}
              >
                {pnlIsPositive ? "+" : ""}
                ${Number(data.unrealizedPnl).toFixed(2)}
                <span className="text-sm ml-1">({data.unrealizedPnlPercent}%)</span>
              </p>
            </div>

            <div className="rounded-lg border px-4 py-3">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Realized P&L
              </p>
              <p
                className={cn(
                  "mt-1 text-xl font-semibold font-mono",
                  realizedPnlPositive ? "text-emerald-400" : "text-red-400",
                )}
              >
                {realizedPnlPositive ? "+" : ""}
                ${realizedPnl.toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-5 md:px-8">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <PortfolioChart />
            <PriceAlerts />
          </div>

          {data.holdings.length > 0 ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Holdings ({data.tokenCount})</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
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
                          className="cursor-pointer hover:bg-muted/50"
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
                          <TableCell className="text-right font-mono">
                            {Number(h.amount).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right font-mono text-muted-foreground">
                            ${Number(h.avgBuyPrice).toFixed(4)}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            ${Number(h.currentPrice).toFixed(4)}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            ${Number(h.currentValue).toFixed(2)}
                          </TableCell>
                          <TableCell
                            className={cn(
                              "text-right font-mono",
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
