import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Copy,
  Map,
  MoreHorizontal,
} from "lucide-react";
import { useCallback } from "react";
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

  const renderSortIcon = useCallback(
    (field: ChunkSortField) => {
      if (sort?.field !== field) {
        return <ArrowUpDown className="ml-1 size-3.5 opacity-50" />;
      }
      return sort.direction === "asc" ? (
        <ArrowUp className="ml-1 size-3.5" />
      ) : (
        <ArrowDown className="ml-1 size-3.5" />
      );
    },
    [sort],
  );

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
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
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>
            <button
              type="button"
              onClick={() => onSortChange("dimension")}
              className="inline-flex items-center gap-1 text-sm font-medium"
            >
              Dimension
              {renderSortIcon("dimension")}
            </button>
          </TableHead>
          <TableHead>
            <button
              type="button"
              onClick={() => onSortChange("x")}
              className="inline-flex items-center gap-1 text-sm font-medium"
            >
              X{renderSortIcon("x")}
            </button>
          </TableHead>
          <TableHead>
            <button
              type="button"
              onClick={() => onSortChange("z")}
              className="inline-flex items-center gap-1 text-sm font-medium"
            >
              Z{renderSortIcon("z")}
            </button>
          </TableHead>
          <TableHead>
            <button
              type="button"
              onClick={() => onSortChange("forceloadable")}
              className="inline-flex items-center gap-1 text-sm font-medium"
            >
              Forceloadable
              {renderSortIcon("forceloadable")}
            </button>
          </TableHead>
          <TableHead>
            <button
              type="button"
              onClick={() => onSortChange("active")}
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
        {chunks.map((chunk) => {
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
