import { Copy } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  DataTable,
  type DataTableAction,
  type DataTableColumn,
} from "@/components/data-table";
import { useToastActions } from "@/hooks/use-toast";
import {
  chunkTpCommand,
  formatDimension,
  regionFileName,
} from "@/lib/minecraft";
import type { DimensionFilter } from "../types";

interface Chunk {
  id: number;
  dimension: string;
  x: number;
  z: number;
  active: boolean;
}

type SortField = "dimension" | "x" | "z" | "active";
type SortDirection = "asc" | "desc";

export function ChunkTable({
  chunks,
  dimensionFilter,
  activeOnly,
}: {
  chunks: Chunk[];
  dimensionFilter: DimensionFilter;
  activeOnly: boolean;
}) {
  const toast = useToastActions();
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      } else {
        setSortField(field);
        setSortDirection("asc");
      }
    },
    [sortField],
  );

  const filtered = useMemo(
    () =>
      chunks.filter((c) => {
        if (dimensionFilter !== "all" && c.dimension !== dimensionFilter)
          return false;
        if (activeOnly && !c.active) return false;
        return true;
      }),
    [chunks, dimensionFilter, activeOnly],
  );

  const sorted = useMemo(() => {
    if (!sortField) return filtered;
    const dir = sortDirection === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      switch (sortField) {
        case "dimension":
          return a.dimension.localeCompare(b.dimension) * dir;
        case "x":
          return (a.x - b.x) * dir;
        case "z":
          return (a.z - b.z) * dir;
        case "active":
          return (Number(a.active) - Number(b.active)) * dir;
      }
    });
  }, [filtered, sortField, sortDirection]);

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const sortProps = (field: SortField) => ({
    sorted: sortField === field ? sortDirection : (false as const),
    onSort: () => handleSort(field),
  });

  const columns: DataTableColumn<Chunk>[] = [
    {
      key: "dimension",
      header: "Dimension",
      minWidth: 140,
      ...sortProps("dimension"),
      cellClassName: "text-xs",
      render: (chunk) => formatDimension(chunk.dimension),
    },
    {
      key: "x",
      header: "X",
      width: 90,
      ...sortProps("x"),
      cellClassName: "font-mono text-xs",
      render: (chunk) => chunk.x,
    },
    {
      key: "z",
      header: "Z",
      width: 90,
      ...sortProps("z"),
      cellClassName: "font-mono text-xs",
      render: (chunk) => chunk.z,
    },
    {
      key: "active",
      header: "Status",
      width: 110,
      ...sortProps("active"),
      render: (chunk) => (
        <Badge
          variant="outline"
          className={
            chunk.active
              ? "border-success bg-success/10 text-success"
              : "border-muted-foreground bg-muted-foreground/10 text-muted-foreground"
          }
        >
          {chunk.active ? "Active" : "Inactive"}
        </Badge>
      ),
    },
  ];

  const chunkActions = (chunk: Chunk): DataTableAction[] => {
    const tp = chunkTpCommand(chunk.dimension, chunk.x, chunk.z);
    return [
      {
        label: "Copy /tp command",
        icon: Copy,
        onClick: () => copy(tp),
      },
      {
        label: "Copy chunk coords",
        icon: Copy,
        onClick: () => copy(`${chunk.x}, ${chunk.z}`),
      },
      {
        label: "Copy block coords (center)",
        icon: Copy,
        onClick: () => copy(`${chunk.x * 16 + 8}, ${chunk.z * 16 + 8}`),
      },
      {
        label: `Copy region file (${regionFileName(chunk.x, chunk.z)})`,
        icon: Copy,
        onClick: () => copy(regionFileName(chunk.x, chunk.z)),
      },
    ];
  };

  if (sorted.length === 0) {
    return (
      <p className="py-2 text-sm text-muted-foreground">
        {chunks.length === 0
          ? "No chunks found"
          : "No chunks match the current filters"}
      </p>
    );
  }

  return (
    <DataTable
      columns={columns}
      rows={sorted}
      rowKey={(chunk) => chunk.id}
      actions={chunkActions}
    />
  );
}
