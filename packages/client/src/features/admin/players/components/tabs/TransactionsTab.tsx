import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { trpc, type RouterOutput } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/format";
import { Paginator } from "@/components/paginator";
import { Badge } from "@/components/ui/badge";
import { CellDate, CellText } from "@/components/cell-text";
import {
  BadgeCellSkeleton,
  DataTable,
  loadingRowCount,
  type DataTableColumn,
} from "@/components/data-table";
import { ArrowLeftRight } from "lucide-react";
import { EmptyState, ErrorState } from "@/components/query-states";

interface TransactionsTabProps {
  playerId: string;
}

type Transaction =
  RouterOutput["admin"]["players"]["transactions"]["list"]["items"][number];

export function TransactionsTab({ playerId }: TransactionsTabProps) {
  const [page, setPage] = useState(0);
  const limit = 20;

  const { data, isLoading, isPlaceholderData, error, refetch } = useQuery(
    trpc.admin.players.transactions.list.queryOptions(
      {
        id: playerId,
        page,
        limit,
      },
      { placeholderData: keepPreviousData },
    ),
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
        const isPositive = tx.amount >= 0;
        return (
          <span
            className={cn(
              "font-mono text-sm font-medium tabular-nums",
              isPositive ? "text-emerald-400" : "text-destructive",
            )}
          >
            {isPositive ? "+" : "-"}
            {formatMoney(Math.abs(tx.amount))}
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
      render: (tx) => formatMoney(tx.balanceBefore),
    },
    {
      key: "after",
      header: "After",
      width: 130,
      align: "right",
      cellClassName: "font-mono text-sm text-muted-foreground tabular-nums",
      render: (tx) => formatMoney(tx.balanceAfter),
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
        <ErrorState message={error.message} onRetry={() => refetch()} />
      ) : !loading && items.length === 0 ? (
        <EmptyState icon={ArrowLeftRight} message="No transactions found" />
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={items}
            loading={loading}
            loadingRows={loadingRows}
            rowKey={(tx) => tx.id}
            rowClassName={(tx) =>
              tx.amount >= 0 ? "bg-emerald-500/[0.02]" : "bg-destructive/[0.02]"
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
