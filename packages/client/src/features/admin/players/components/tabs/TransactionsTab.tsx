import { trpc, type RouterOutput } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { formatMoney } from "@createrington/shared/format";
import { Badge } from "@/components/ui/badge";
import { CellDate, CellText } from "@/components/cell-text";
import {
  BadgeCellSkeleton,
  type DataTableColumn,
} from "@/components/data-table";
import { PagedTable } from "@/components/paged-table";
import { usePagedQuery } from "@/hooks/use-paged-query";
import { ArrowLeftRight } from "lucide-react";
import { TabSectionHeader } from "@/features/admin/players/components/TabSectionHeader";
import { useOverlayMask } from "@/hooks/use-admin-overlay";

interface TransactionsTabProps {
  playerId: string;
}

type Transaction =
  RouterOutput["admin"]["players"]["transactions"]["list"]["items"][number];

export function TransactionsTab({ playerId }: TransactionsTabProps) {
  const mask = useOverlayMask();
  const transactions = usePagedQuery({ id: playerId }, (input) =>
    trpc.admin.players.transactions.list.queryOptions(input),
  );

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
            {...mask}
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
      render: (tx) => <span {...mask}>{formatMoney(tx.balanceBefore)}</span>,
    },
    {
      key: "after",
      header: "After",
      width: 130,
      align: "right",
      cellClassName: "font-mono text-sm text-muted-foreground tabular-nums",
      render: (tx) => <span {...mask}>{formatMoney(tx.balanceAfter)}</span>,
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
      <TabSectionHeader
        title="Transactions"
        description={`${transactions.total.toLocaleString()} total`}
      />

      <PagedTable
        paged={transactions}
        empty={{ icon: ArrowLeftRight, message: "No transactions found" }}
        itemLabel="transaction"
        columns={columns}
        rowKey={(tx) => tx.id}
        rowClassName={(tx) =>
          tx.amount >= 0 ? "bg-emerald-500/[0.02]" : "bg-destructive/[0.02]"
        }
      />
    </div>
  );
}
