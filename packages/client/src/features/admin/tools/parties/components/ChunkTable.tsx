import { Copy, MoreHorizontal } from "lucide-react";
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

  const filtered = chunks.filter((c) => {
    if (dimensionFilter !== "all" && c.dimension !== dimensionFilter)
      return false;
    if (activeOnly && !c.active) return false;
    return true;
  });

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  if (filtered.length === 0) {
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
          <TableHead>Dimension</TableHead>
          <TableHead>X</TableHead>
          <TableHead>Z</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="w-24 text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filtered.map((chunk) => {
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
