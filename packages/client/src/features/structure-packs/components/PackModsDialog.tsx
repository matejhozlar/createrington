import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Blocks, ExternalLink, Package } from "lucide-react";

interface PackMod {
  id: number;
  modName: string;
  modUrl: string | null;
  thumbnailUrl: string | null;
  fileName: string;
}

interface PackModsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  packName: string;
  mods: PackMod[];
}

export function PackModsDialog({
  open,
  onOpenChange,
  packName,
  mods,
}: PackModsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{packName}</DialogTitle>
          <DialogDescription>
            {mods.length} {mods.length === 1 ? "mod" : "mods"} included in this
            pack
          </DialogDescription>
        </DialogHeader>

        {mods.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Package className="mb-2 size-8 opacity-50" />
            <p className="text-sm">No mods in this pack yet</p>
          </div>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto rounded-md border divide-y">
            {mods.map((mod) => (
              <div
                key={mod.id}
                className="flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors"
              >
                {mod.thumbnailUrl ? (
                  <img
                    src={mod.thumbnailUrl}
                    alt=""
                    className="size-10 shrink-0 rounded object-cover"
                  />
                ) : (
                  <div className="flex size-10 shrink-0 items-center justify-center rounded bg-muted">
                    <Blocks className="size-5 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm truncate">
                    {mod.modName}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {mod.fileName}
                  </div>
                </div>
                {mod.modUrl && (
                  <a
                    href={mod.modUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
                  >
                    CurseForge
                    <ExternalLink className="size-3" />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
