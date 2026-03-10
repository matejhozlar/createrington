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
import { ArrowLeft, TrendingUp, TrendingDown, Wallet, DollarSign } from "lucide-react";

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
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1"
          onClick={() => navigate("/crypto")}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Market
        </Button>
        <h1 className="text-2xl font-bold">Portfolio</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-blue-500/10 p-2">
              <Wallet className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Value</p>
              <p className="text-lg font-bold font-mono">
                ${Number(data.totalValue).toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-amber-500/10 p-2">
              <TrendingUp className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Invested</p>
              <p className="text-lg font-bold font-mono">
                ${Number(data.totalInvested).toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div
              className={cn(
                "rounded-lg p-2",
                pnlIsPositive ? "bg-emerald-500/10" : "bg-red-500/10",
              )}
            >
              {pnlIsPositive ? (
                <TrendingUp className="h-5 w-5 text-emerald-500" />
              ) : (
                <TrendingDown className="h-5 w-5 text-red-500" />
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Unrealized P&L</p>
              <p
                className={cn(
                  "text-lg font-bold font-mono",
                  pnlIsPositive ? "text-emerald-400" : "text-red-400",
                )}
              >
                {pnlIsPositive ? "+" : ""}
                ${Number(data.unrealizedPnl).toFixed(2)} ({data.unrealizedPnlPercent}%)
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div
              className={cn(
                "rounded-lg p-2",
                realizedPnlPositive ? "bg-emerald-500/10" : "bg-red-500/10",
              )}
            >
              <DollarSign
                className={cn(
                  "h-5 w-5",
                  realizedPnlPositive ? "text-emerald-500" : "text-red-500",
                )}
              />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Realized P&L</p>
              <p
                className={cn(
                  "text-lg font-bold font-mono",
                  realizedPnlPositive ? "text-emerald-400" : "text-red-400",
                )}
              >
                {realizedPnlPositive ? "+" : ""}
                ${realizedPnl.toFixed(2)}
              </p>
            </div>
          </CardContent>
        </Card>
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
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p>You don't have any holdings yet.</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => navigate("/crypto")}
            >
              Browse Tokens
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
