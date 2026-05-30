import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Copy,
  MoreHorizontal,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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

  const renderSortIcon = useCallback(
    (field: SortField) => {
      if (sortField !== field) {
        return <ArrowUpDown className="ml-1 size-3.5 opacity-50" />;
      }
      return sortDirection === "asc" ? (
        <ArrowUp className="ml-1 size-3.5" />
      ) : (
        <ArrowDown className="ml-1 size-3.5" />
      );
    },
    [sortField, sortDirection],
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
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>
            <button
              type="button"
              onClick={() => handleSort("dimension")}
              className="inline-flex items-center gap-1 text-sm font-medium"
            >
              Dimension
              {renderSortIcon("dimension")}
            </button>
          </TableHead>
          <TableHead>
            <button
              type="button"
              onClick={() => handleSort("x")}
              className="inline-flex items-center gap-1 text-sm font-medium"
            >
              X{renderSortIcon("x")}
            </button>
          </TableHead>
          <TableHead>
            <button
              type="button"
              onClick={() => handleSort("z")}
              className="inline-flex items-center gap-1 text-sm font-medium"
            >
              Z{renderSortIcon("z")}
            </button>
          </TableHead>
          <TableHead>
            <button
              type="button"
              onClick={() => handleSort("active")}
              className="inline-flex items-center gap-1 text-sm font-medium"
            >
              Status
              {renderSortIcon("active")}
            </button>
          </TableHead>
          <TableHead className="w-24 text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((chunk) => {
          const tp = chunkTpCommand(chunk.dimension, chunk.x, chunk.z);
          return (
            <TableRow key={chunk.id}>
              <TableCell className="text-xs">
                {formatDimension(chunk.dimension)}
              </TableCell>
              <TableCell className="font-mono text-xs">{chunk.x}</TableCell>
              <TableCell className="font-mono text-xs">{chunk.z}</TableCell>
              <TableCell>
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
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={() => copy(tp)}
                        aria-label="Copy /tp command"
                      >
                        <Copy className="size-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <span className="font-mono text-[11px]">{tp}</span>
                    </TooltipContent>
                  </Tooltip>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        aria-label="More actions"
                      >
                        <MoreHorizontal className="size-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuLabel>Copy</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => copy(tp)}>
                        /tp command
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => copy(`${chunk.x}, ${chunk.z}`)}
                      >
                        Chunk coords
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() =>
                          copy(`${chunk.x * 16 + 8}, ${chunk.z * 16 + 8}`)
                        }
                      >
                        Block coords (center)
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => copy(regionFileName(chunk.x, chunk.z))}
                      >
                        Region file ({regionFileName(chunk.x, chunk.z)})
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
