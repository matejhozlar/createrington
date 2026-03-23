import { useCallback, useState } from "react";
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
import {
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { ArrowLeftRight } from "lucide-react";

export function TradeHistory() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [page, setPage] = useState(0);

  const { data, isLoading, error, refetch } =
    trpc.user.crypto.tradeHistory.useQuery(
      { page, limit: 20 },
      { enabled: !!user },
    );

  const totalPages = data?.pagination.totalPages ?? 0;

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  const getPaginationItems = useCallback(() => {
    const items: (number | "ellipsis")[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      return Array.from({ length: totalPages }, (_, i) => i);
    }

    items.push(0);

    if (page <= 2) {
      items.push(1, 2, 3);
      items.push("ellipsis");
      items.push(totalPages - 1);
    } else if (page >= totalPages - 3) {
      items.push("ellipsis");
      items.push(
        totalPages - 4,
        totalPages - 3,
        totalPages - 2,
        totalPages - 1,
      );
    } else {
      items.push("ellipsis");
      items.push(page - 1, page, page + 1);
      items.push("ellipsis");
      items.push(totalPages - 1);
    }

    return items;
  }, [page, totalPages]);

  if (!user) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        Sign in to view your trade history
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loading size="medium" text="Loading trades..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <ArrowLeftRight className="size-12 text-muted-foreground mb-4" />
        <p className="text-destructive">{error.message}</p>
        <Button onClick={() => refetch()} className="mt-4" variant="outline">
          Try Again
        </Button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="flex flex-1 flex-col px-5 md:px-8 pt-5 pb-16">
      <div className="max-w-7xl mx-auto w-full space-y-5">
        <div className="flex items-baseline justify-between">
          <h1 className="text-xl font-bold tracking-tight">Trade History</h1>
        </div>
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
                        isBuy
                          ? "bg-emerald-500/[0.02]"
                          : "bg-destructive/[0.02]",
                      )}
                    >
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(tx.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <span
                          className="cursor-pointer font-mono text-sm hover:underline hover:text-primary transition-colors"
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
                              ? "text-emerald-400 border-emerald-500/20 bg-emerald-500/5"
                              : "text-destructive border-destructive/20 bg-destructive/5",
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
                                : "text-destructive",
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

        {totalPages > 1 && (
          <div className="flex items-center justify-center">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    if (page > 0) handlePageChange(page - 1);
                  }}
                  className={cn(
                    page === 0 && "pointer-events-none opacity-50",
                  )}
                />
              </PaginationItem>

              {getPaginationItems().map((item, index) => (
                <PaginationItem
                  key={item === "ellipsis" ? `ellipsis-${index}` : item}
                >
                  {item === "ellipsis" ? (
                    <PaginationEllipsis />
                  ) : (
                    <PaginationLink
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        handlePageChange(item);
                      }}
                      isActive={page === item}
                    >
                      {item + 1}
                    </PaginationLink>
                  )}
                </PaginationItem>
              ))}

              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    if (page < totalPages - 1) handlePageChange(page + 1);
                  }}
                  className={cn(
                    page >= totalPages - 1 &&
                      "pointer-events-none opacity-50",
                  )}
                />
              </PaginationItem>
            </PaginationContent>
          </div>
        )}
      </div>
    </div>
  );
}
