import { Copy, Map } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DataTable,
  type DataTableAction,
  type DataTableColumn,
} from "@/components/data-table";
import { useToastActions } from "@/hooks/use-toast";
import {
  chunkBluemapUrl,
  chunkTpCommand,
  formatDimension,
  regionFileName,
} from "@/lib/minecraft";

interface ChunkDetail {
  id: number;
  dimension: string;
  x: number;
  z: number;
  forceloadable: boolean;
  active: boolean;
}

export type ChunkSortField =
  "dimension" | "x" | "z" | "forceloadable" | "active";
export type ChunkSortDirection = "asc" | "desc";
export type ChunkSortState = {
  field: ChunkSortField;
  direction: ChunkSortDirection;
} | null;

export function ChunkDetailTable({
  chunks,
  hasActiveFilters = false,
  sort,
  onSortChange,
}: {
  chunks: ChunkDetail[];
  hasActiveFilters?: boolean;
  sort: ChunkSortState;
  onSortChange: (field: ChunkSortField) => void;
}) {
  const toast = useToastActions();

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const sortProps = (field: ChunkSortField) => ({
    sorted: sort?.field === field ? sort.direction : (false as const),
    onSort: () => onSortChange(field),
  });

  const columns: DataTableColumn<ChunkDetail>[] = [
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
      key: "forceloadable",
      header: "Forceloadable",
      width: 155,
      ...sortProps("forceloadable"),
      render: (chunk) => (
        <Badge
          variant="outline"
          className={
            chunk.forceloadable
              ? "border-amber-500 bg-amber-500/10 text-amber-500"
              : "border-muted-foreground bg-muted-foreground/10 text-muted-foreground"
          }
        >
          {chunk.forceloadable ? "Yes" : "No"}
        </Badge>
      ),
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

  const chunkActions = (chunk: ChunkDetail): DataTableAction[] => {
    const tp = chunkTpCommand(chunk.dimension, chunk.x, chunk.z);
    return [
      {
        label: "Copy /tp command",
        icon: Copy,
        onClick: () => copy(tp),
      },
      {
        label: "Open in BlueMap",
        icon: Map,
        onClick: () =>
          window.open(
            chunkBluemapUrl(chunk.dimension, chunk.x, chunk.z),
            "_blank",
            "noopener,noreferrer",
          ),
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

  if (chunks.length === 0) {
    return (
      <p className="py-2 text-sm text-muted-foreground">
        {hasActiveFilters
          ? "No chunks match the current filters"
          : "No chunks found"}
      </p>
    );
  }

  return (
    <DataTable
      columns={columns}
      rows={chunks}
      rowKey={(chunk) => chunk.id}
      actions={chunkActions}
    />
  );
}
