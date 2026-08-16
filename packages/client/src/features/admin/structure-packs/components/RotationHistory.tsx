import { useState } from "react";
import { keepPreviousData } from "@tanstack/react-query";
import { trpc, type RouterOutput } from "@/lib/trpc";
import { History, CheckCircle2, XCircle } from "lucide-react";
import { Paginator } from "@/components/paginator";
import { Badge } from "@/components/ui/badge";
import { CellDate, CellText } from "@/components/cell-text";
import {
  BadgeCellSkeleton,
  DataTable,
  loadingRowCount,
  type DataTableColumn,
} from "@/components/data-table";

type Rotation =
  RouterOutput["admin"]["structurePacks"]["rotationHistory"]["data"][number];

/** Paginated table of past structure pack rotation events with success/failure status */
export function RotationHistory() {
  const [page, setPage] = useState(0);
  const limit = 10;

  const historyQuery = trpc.admin.structurePacks.rotationHistory.useQuery(
    {
      page,
      limit,
    },
    { placeholderData: keepPreviousData },
  );
  const data = historyQuery.data;
  const total = data?.pagination.total ?? 0;
  const totalPages = data?.pagination.totalPages ?? 0;
  const loading = historyQuery.isLoading || historyQuery.isPlaceholderData;
  const loadingRows = loadingRowCount(page, limit, total);

  const packsQuery = trpc.admin.structurePacks.list.useQuery();
  const packMap = new Map((packsQuery.data ?? []).map((p) => [p.id, p.name]));

  const columns: DataTableColumn<Rotation>[] = [
    {
      key: "date",
      header: "Date",
      width: 110,
      render: (rotation) => <CellDate value={rotation.rotatedAt} />,
    },
    {
      key: "from",
      header: "From",
      minWidth: 120,
      cellClassName: "text-sm",
      render: (rotation) =>
        rotation.outgoingPackId && (
          <CellText
            value={
              packMap.get(rotation.outgoingPackId) ??
              `Pack #${rotation.outgoingPackId}`
            }
          />
        ),
    },
    {
      key: "to",
      header: "To",
      minWidth: 120,
      cellClassName: "text-sm",
      render: (rotation) => (
        <CellText
          value={
            packMap.get(rotation.incomingPackId) ??
            `Pack #${rotation.incomingPackId}`
          }
        />
      ),
    },
    {
      key: "status",
      header: "Status",
      width: 100,
      skeleton: () => <BadgeCellSkeleton />,
      render: (rotation) =>
        rotation.success ? (
          <Badge className="bg-green-500/20 text-green-500 hover:bg-green-500/30">
            <CheckCircle2 className="mr-1 size-3" />
            OK
          </Badge>
        ) : (
          <Badge variant="destructive">
            <XCircle className="mr-1 size-3" />
            Failed
          </Badge>
        ),
    },
  ];

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="mb-4">
        <h2 className="flex items-center gap-2 font-semibold">
          <History className="size-4" />
          Rotation History
        </h2>
        <p className="text-sm text-muted-foreground">Past rotation events</p>
      </div>
      {!loading && (!data || data.data.length === 0) ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          No rotations yet
        </p>
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={data?.data ?? []}
            loading={loading}
            loadingRows={loadingRows}
            rowKey={(rotation) => rotation.id}
          />

          <Paginator
            page={page}
            limit={limit}
            total={total}
            totalPages={totalPages}
            onPageChange={setPage}
            itemLabel="rotation"
            className="mt-4"
          />
        </>
      )}
    </div>
  );
}
