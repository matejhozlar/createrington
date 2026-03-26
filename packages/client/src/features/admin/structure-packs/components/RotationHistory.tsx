import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { History, CheckCircle2, XCircle } from "lucide-react";
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

export function RotationHistory() {
  const [page, setPage] = useState(0);
  const limit = 10;

  const historyQuery = trpc.admin.structurePacks.rotationHistory.useQuery({
    page,
    limit,
  });
  const data = historyQuery.data;

  // Need pack names for display — grab the pack list
  const packsQuery = trpc.admin.structurePacks.list.useQuery();
  const packMap = new Map(
    (packsQuery.data ?? []).map((p) => [p.id, p.name]),
  );

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="mb-4">
        <h2 className="flex items-center gap-2 font-semibold">
          <History className="size-4" />
          Rotation History
        </h2>
        <p className="text-sm text-muted-foreground">Past rotation events</p>
      </div>
      {!data || data.data.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          No rotations yet
        </p>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.data.map((rotation) => (
                <TableRow key={rotation.id}>
                  <TableCell className="text-sm">
                    {new Date(rotation.rotatedAt).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-sm">
                    {rotation.outgoingPackId
                      ? (packMap.get(rotation.outgoingPackId) ??
                        `Pack #${rotation.outgoingPackId}`)
                      : "-"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {packMap.get(rotation.incomingPackId) ??
                      `Pack #${rotation.incomingPackId}`}
                  </TableCell>
                  <TableCell>
                    {rotation.success ? (
                      <Badge className="bg-green-500/20 text-green-500 hover:bg-green-500/30">
                        <CheckCircle2 className="mr-1 size-3" />
                        OK
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        <XCircle className="mr-1 size-3" />
                        Failed
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {data.pagination.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Page {page + 1} of {data.pagination.totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="cursor-pointer"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="cursor-pointer"
                  disabled={page >= data.pagination.totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
