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
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";

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
    return <Loading mode="inline" size="large" text="Loading trades..." className="py-12" />;
  }

  if (!data) return null;

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

          <h1 className="text-3xl md:text-4xl font-semibold">Trade History</h1>
        </div>
      </div>

      <div className="px-5 md:px-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Token</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Fee</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">P&L</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((tx) => {
                    const isBuy = tx.type === "buy";
                    return (
                      <TableRow key={tx.id}>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(tx.createdAt).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <span
                            className="cursor-pointer font-mono text-sm hover:underline"
                            onClick={() => navigate(`/crypto/${tx.tokenSymbol}`)}
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
                                ? "text-emerald-400 border-emerald-500/20"
                                : "text-red-400 border-red-500/20",
                            )}
                          >
                            {tx.type.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {Number(tx.amount).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          ${Number(tx.priceAtExecution).toFixed(4)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm text-muted-foreground">
                          ${Number(tx.feeAmount).toFixed(4)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          ${Number(tx.totalCost).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {tx.realizedPnl ? (
                            <span
                              className={
                                Number(tx.realizedPnl) >= 0
                                  ? "text-emerald-400"
                                  : "text-red-400"
                              }
                            >
                              {Number(tx.realizedPnl) >= 0 ? "+" : ""}
                              ${Number(tx.realizedPnl).toFixed(2)}
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
                        className="py-8 text-center text-muted-foreground"
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
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page + 1} of {data.pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= data.pagination.totalPages - 1}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
