import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Copy,
  Map,
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

type SortField = "dimension" | "x" | "z" | "forceloadable" | "active";
type SortDirection = "asc" | "desc";

/**
 * Presentational chunk table. Filtering + pagination are handled upstream
 * (server-side, via tRPC inputs) so that page totals stay accurate. Sorting
 * is applied client-side to the current page's items only.
 */
export function ChunkDetailTable({
  chunks,
  hasActiveFilters = false,
}: {
  chunks: ChunkDetail[];
  /** When true, the empty state explains "no matches" instead of "no chunks". */
  hasActiveFilters?: boolean;
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

  const sorted = useMemo(() => {
    if (!sortField) return chunks;
    const dir = sortDirection === "asc" ? 1 : -1;
    return [...chunks].sort((a, b) => {
      switch (sortField) {
        case "dimension":
          return a.dimension.localeCompare(b.dimension) * dir;
        case "x":
          return (a.x - b.x) * dir;
        case "z":
          return (a.z - b.z) * dir;
        case "forceloadable":
          return (Number(a.forceloadable) - Number(b.forceloadable)) * dir;
        case "active":
          return (Number(a.active) - Number(b.active)) * dir;
      }
    });
  }, [chunks, sortField, sortDirection]);

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  if (sorted.length === 0) {
    return (
      <p className="py-2 text-sm text-muted-foreground">
        {hasActiveFilters
          ? "No chunks match the current filters"
          : "No chunks found"}
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
              onClick={() => handleSort("forceloadable")}
              className="inline-flex items-center gap-1 text-sm font-medium"
            >
              Forceloadable
              {renderSortIcon("forceloadable")}
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
                    chunk.forceloadable
                      ? "border-amber-500 bg-amber-500/10 text-amber-500"
                      : "border-muted-foreground bg-muted-foreground/10 text-muted-foreground"
                  }
                >
                  {chunk.forceloadable ? "Yes" : "No"}
                </Badge>
              </TableCell>
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
                        onClick={() => copy(tp, "/tp command")}
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
                      <DropdownMenuItem asChild>
                        <a
                          href={chunkBluemapUrl(
                            chunk.dimension,
                            chunk.x,
                            chunk.z,
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Map className="mr-2 size-3.5" />
                          Open in BlueMap
                        </a>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel>Copy</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => copy(tp, "/tp command")}>
                        /tp command
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() =>
                          copy(`${chunk.x}, ${chunk.z}`, "Chunk coords")
                        }
                      >
                        Chunk coords
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() =>
                          copy(
                            `${chunk.x * 16 + 8}, ${chunk.z * 16 + 8}`,
                            "Block coords",
                          )
                        }
                      >
                        Block coords (center)
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() =>
                          copy(
                            regionFileName(chunk.x, chunk.z),
                            "Region file name",
                          )
                        }
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
