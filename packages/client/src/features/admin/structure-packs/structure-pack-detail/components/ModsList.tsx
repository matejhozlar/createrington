import { ExternalLink, Package, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { RemoveTarget } from "../types";

interface Mod {
  id: number;
  modName: string;
  fileName: string;
  modUrl?: string | null;
  thumbnailUrl?: string | null;
  curseforgeModId: number;
}

export function ModsList({
  mods,
  onAdd,
  onRemove,
}: {
  mods: Mod[];
  onAdd: () => void;
  onRemove: (target: RemoveTarget) => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Mods</h2>
          <p className="text-sm text-muted-foreground">
            CurseForge mods included in this pack
          </p>
        </div>
        <Button size="sm" onClick={onAdd}>
          <Plus className="size-4" />
          Add Mod
        </Button>
      </div>
      {mods.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <Package className="mb-2 size-8" />
          <p>No mods added yet</p>
        </div>
      ) : (
        <Table className="min-w-[438px]">
          <TableHeader>
            <TableRow>
              <TableHead>Mod</TableHead>
              <TableHead className="w-[180px]">File</TableHead>
              <TableHead col="icon" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {mods.map((mod) => (
              <TableRow key={mod.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {mod.thumbnailUrl && (
                      <img
                        src={mod.thumbnailUrl}
                        alt=""
                        className="size-8 shrink-0 rounded"
                      />
                    )}
                    <div className="min-w-0">
                      <div className="truncate font-medium">{mod.modName}</div>
                      {mod.modUrl && (
                        <a
                          href={mod.modUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          CurseForge
                          <ExternalLink className="size-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {mod.fileName}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() =>
                      onRemove({
                        modId: mod.id,
                        modName: mod.modName,
                        fileName: mod.fileName,
                      })
                    }
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
