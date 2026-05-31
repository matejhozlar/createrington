import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Loading } from "@/components/loading-spinner";
import { Paginator } from "@/components/paginator";
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
import { ArrowLeftRight } from "lucide-react";

interface TransactionsTabProps {
  playerId: string;
}

export function TransactionsTab({ playerId }: TransactionsTabProps) {
  const [page, setPage] = useState(0);
  const limit = 20;

  const { data, isLoading, error, refetch } =
    trpc.admin.players.transactions.list.useQuery({
      id: playerId,
      page,
      limit,
    });

  const items = data?.items ?? [];
  const total = data?.pagination.total ?? 0;
  const totalPages = data?.pagination.totalPages ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Transactions</h3>
          <p className="text-sm text-muted-foreground">
            {total.toLocaleString()} total
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loading size="medium" text="Loading transactions..." />
        </div>
      ) : error ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <p className="text-destructive">{error.message}</p>
            <Button
              onClick={() => refetch()}
              className="mt-4"
              variant="outline"
            >
              Try Again
            </Button>
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="py-12 text-center">
          <ArrowLeftRight className="mx-auto size-12 text-muted-foreground" />
          <p className="mt-2 text-muted-foreground">No transactions found</p>
        </div>
      ) : (
        <>
          <div className="-mx-6 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-[11px] font-medium uppercase tracking-wider">
                    Date
                  </TableHead>
                  <TableHead className="text-[11px] font-medium uppercase tracking-wider">
                    Type
                  </TableHead>
                  <TableHead className="text-right text-[11px] font-medium uppercase tracking-wider">
                    Amount
                  </TableHead>
                  <TableHead className="text-right text-[11px] font-medium uppercase tracking-wider">
                    Before
                  </TableHead>
                  <TableHead className="text-right text-[11px] font-medium uppercase tracking-wider">
                    After
                  </TableHead>
                  <TableHead className="text-[11px] font-medium uppercase tracking-wider">
                    Description
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((tx) => {
                  const amount = Number(tx.amount);
                  const isPositive = amount >= 0;
                  return (
                    <TableRow
                      key={tx.id}
                      className={cn(
                        "border-b border-border/30 last:border-0",
                        isPositive
                          ? "bg-emerald-500/[0.02]"
                          : "bg-destructive/[0.02]",
                      )}
                    >
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {new Date(tx.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {tx.transactionType}
                        </Badge>
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-mono tabular-nums text-sm font-medium",
                          isPositive ? "text-emerald-400" : "text-destructive",
                        )}
                      >
                        {isPositive ? "+" : ""}
                        {amount.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums text-sm text-muted-foreground">
                        {Number(tx.balanceBefore).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums text-sm text-muted-foreground">
                        {Number(tx.balanceAfter).toLocaleString()}
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                        {tx.description ?? "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <Paginator
            page={page}
            limit={limit}
            total={total}
            totalPages={totalPages}
            onPageChange={setPage}
            itemLabel="transaction"
            className="border-t border-border pt-4"
          />
        </>
      )}
    </div>
  );
}
