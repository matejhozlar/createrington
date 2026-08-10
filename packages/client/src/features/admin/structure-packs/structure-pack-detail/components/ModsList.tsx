import { ExternalLink, Package, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CellText } from "@/components/cell-text";
import { DataTable, type DataTableColumn } from "@/components/data-table";
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
  const columns: DataTableColumn<Mod>[] = [
    {
      key: "mod",
      header: "Mod",
      minWidth: 200,
      render: (mod) => (
        <div className="flex min-w-0 items-center gap-2">
          {mod.thumbnailUrl && (
            <img
              src={mod.thumbnailUrl}
              alt=""
              className="size-8 shrink-0 rounded"
            />
          )}
          <div className="min-w-0">
            <CellText value={mod.modName} className="font-medium" />
            {mod.modUrl && (
              <a
                href={mod.modUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:underline"
              >
                CurseForge
                <ExternalLink className="size-3" />
              </a>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "file",
      header: "File",
      minWidth: 160,
      cellClassName: "text-sm text-muted-foreground",
      render: (mod) => <CellText value={mod.fileName} />,
    },
  ];

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
        <DataTable
          columns={columns}
          rows={mods}
          rowKey={(mod) => mod.id}
          actions={(mod) => [
            {
              label: "Remove",
              icon: Trash2,
              variant: "destructive",
              onClick: () =>
                onRemove({
                  modId: mod.id,
                  modName: mod.modName,
                  fileName: mod.fileName,
                }),
            },
          ]}
          actionSlots={1}
        />
      )}
    </div>
  );
}
