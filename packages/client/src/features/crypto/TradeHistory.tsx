import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth";
import { Loading } from "@/components/loading-spinner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronLeft, ChevronRight, History } from "lucide-react";

export function TradeHistory() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [page, setPage] = useState(0);

  const { data, isLoading } = trpc.user.crypto.tradeHistory.useQuery(
    { page, limit: 20 },
    { enabled: !!user },
  );

  if (!user) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        Sign in to view your trade history
      </div>
    );
  }

  if (isLoading) {
    return (
      <Loading
        mode="inline"
        size="large"
        text="Loading trades..."
        className="py-12"
      />
    );
  }

  if (!data) return null;

  return (
    <div className="flex flex-1 flex-col pb-16">
      {/* Header */}
      <div className="relative overflow-hidden border-b border-border/50">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] via-transparent to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
        <div className="relative px-5 md:px-8 pt-5 pb-5">
          <div className="max-w-7xl mx-auto space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
                  <History className="size-5 text-primary" />
                </div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                  Trade History
                </h1>
              </div>
              {data.pagination.totalPages > 0 && (
                <span className="text-sm text-muted-foreground font-mono tabular-nums">
                  {data.pagination.totalPages * 20}+ trades
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="px-5 md:px-8 pt-5">
        <div className="max-w-7xl mx-auto space-y-5">
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-[11px] font-medium uppercase tracking-wider">
                      Date
                    </TableHead>
                    <TableHead className="text-[11px] font-medium uppercase tracking-wider">
                      Token
                    </TableHead>
                    <TableHead className="text-[11px] font-medium uppercase tracking-wider">
                      Type
                    </TableHead>
                    <TableHead className="text-right text-[11px] font-medium uppercase tracking-wider">
                      Amount
                    </TableHead>
                    <TableHead className="text-right text-[11px] font-medium uppercase tracking-wider">
                      Price
                    </TableHead>
                    <TableHead className="text-right text-[11px] font-medium uppercase tracking-wider">
                      Fee
                    </TableHead>
                    <TableHead className="text-right text-[11px] font-medium uppercase tracking-wider">
                      Total
                    </TableHead>
                    <TableHead className="text-right text-[11px] font-medium uppercase tracking-wider">
                      P&L
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((tx) => {
                    const isBuy = tx.type === "buy";
                    return (
                      <TableRow
                        key={tx.id}
                        className={cn(
                          "border-b border-border/30 last:border-0 relative",
                          isBuy ? "bg-emerald-500/[0.02]" : "bg-red-500/[0.02]",
                        )}
                      >
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(tx.createdAt).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <span
                            className="cursor-pointer font-mono text-sm hover:underline hover:text-primary transition-colors"
                            onClick={() =>
                              navigate(`/crypto/${tx.tokenSymbol}`)
                            }
                          >
                            {tx.tokenSymbol}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-xs",
                              isBuy
                                ? "text-emerald-400 border-emerald-500/20 bg-emerald-500/5"
                                : "text-red-400 border-red-500/20 bg-red-500/5",
                            )}
                          >
                            {tx.type.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-sm">
                          {Number(tx.amount).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-sm">
                          ${Number(tx.priceAtExecution).toFixed(4)}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-sm text-muted-foreground">
                          ${Number(tx.feeAmount).toFixed(4)}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-sm font-medium">
                          ${Number(tx.totalCost).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-sm">
                          {tx.realizedPnl ? (
                            <span
                              className={cn(
                                "font-medium",
                                Number(tx.realizedPnl) >= 0
                                  ? "text-emerald-400"
                                  : "text-red-400",
                              )}
                            >
                              {Number(tx.realizedPnl) >= 0 ? "+" : ""}$
                              {Number(tx.realizedPnl).toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {data.items.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="py-12 text-center text-muted-foreground"
                      >
                        No trades yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {data.pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="text-sm text-muted-foreground tabular-nums font-mono">
                {page + 1} / {data.pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= data.pagination.totalPages - 1}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
