import { useState } from "react";
import { keepPreviousData } from "@tanstack/react-query";
import { trpc, type RouterOutput } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Paginator } from "@/components/paginator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CellDate, CellText } from "@/components/cell-text";
import {
  BadgeCellSkeleton,
  DataTable,
  loadingRowCount,
  type DataTableColumn,
} from "@/components/data-table";
import { ArrowLeftRight } from "lucide-react";

interface TransactionsTabProps {
  playerId: string;
}

type Transaction =
  RouterOutput["admin"]["players"]["transactions"]["list"]["items"][number];

export function TransactionsTab({ playerId }: TransactionsTabProps) {
  const [page, setPage] = useState(0);
  const limit = 20;

  const { data, isLoading, isPlaceholderData, error, refetch } =
    trpc.admin.players.transactions.list.useQuery(
      {
        id: playerId,
        page,
        limit,
      },
      { placeholderData: keepPreviousData },
    );

  const items = data?.items ?? [];
  const total = data?.pagination.total ?? 0;
  const totalPages = data?.pagination.totalPages ?? 0;
  const loading = isLoading || isPlaceholderData;
  const loadingRows = loadingRowCount(page, limit, total);

  const columns: DataTableColumn<Transaction>[] = [
    {
      key: "date",
      header: "Date",
      width: 115,
      render: (tx) => <CellDate value={tx.createdAt} />,
    },
    {
      key: "type",
      header: "Type",
      width: 150,
      skeleton: () => <BadgeCellSkeleton />,
      render: (tx) => (
        <Badge variant="outline" className="max-w-full text-xs">
          <CellText value={tx.transactionType} className="min-w-0" />
        </Badge>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      width: 130,
      align: "right",
      render: (tx) => {
        const amount = Number(tx.amount);
        const isPositive = amount >= 0;
        return (
          <span
            className={cn(
              "font-mono text-sm font-medium tabular-nums",
              isPositive ? "text-emerald-400" : "text-destructive",
            )}
          >
            {isPositive ? "+" : ""}
            {amount.toLocaleString()}
          </span>
        );
      },
    },
    {
      key: "before",
      header: "Before",
      width: 130,
      align: "right",
      cellClassName: "font-mono text-sm text-muted-foreground tabular-nums",
      render: (tx) => Number(tx.balanceBefore).toLocaleString(),
    },
    {
      key: "after",
      header: "After",
      width: 130,
      align: "right",
      cellClassName: "font-mono text-sm text-muted-foreground tabular-nums",
      render: (tx) => Number(tx.balanceAfter).toLocaleString(),
    },
    {
      key: "description",
      header: "Description",
      minWidth: 200,
      cellClassName: "text-sm text-muted-foreground",
      render: (tx) => tx.description && <CellText value={tx.description} />,
    },
  ];

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

      {error ? (
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
      ) : !loading && items.length === 0 ? (
        <div className="py-12 text-center">
          <ArrowLeftRight className="mx-auto size-12 text-muted-foreground" />
          <p className="mt-2 text-muted-foreground">No transactions found</p>
        </div>
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={items}
            loading={loading}
            loadingRows={loadingRows}
            rowKey={(tx) => tx.id}
            rowClassName={(tx) =>
              Number(tx.amount) >= 0
                ? "bg-emerald-500/[0.02]"
                : "bg-destructive/[0.02]"
            }
          />

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
