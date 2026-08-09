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
      <DialogContent
        className="border-white/10 bg-white/[0.03] text-white shadow-2xl shadow-black/40 backdrop-blur-2xl sm:max-w-lg"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-white">{packName}</DialogTitle>
          <DialogDescription className="text-white/55">
            {mods.length} {mods.length === 1 ? "mod" : "mods"} included in this
            dimension
          </DialogDescription>
        </DialogHeader>

        {mods.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-white/50">
            <Package className="mb-2 size-8 opacity-50" />
            <p className="text-sm">No mods in this dimension yet</p>
          </div>
        ) : (
          <div className="max-h-[60vh] divide-y divide-white/10 overflow-y-auto rounded-xl border border-white/10 bg-white/[0.02]">
            {mods.map((mod) => (
              <div
                key={mod.id}
                className="flex items-center gap-3 p-3 transition-colors hover:bg-white/[0.04]"
              >
                {mod.thumbnailUrl ? (
                  <img
                    src={mod.thumbnailUrl}
                    alt=""
                    className="size-10 shrink-0 rounded object-cover"
                  />
                ) : (
                  <div className="flex size-10 shrink-0 items-center justify-center rounded bg-white/5">
                    <Blocks className="size-5 text-white/50" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-white">
                    {mod.modName}
                  </div>
                  <div className="truncate text-xs text-white/45">
                    {mod.fileName}
                  </div>
                </div>
                {mod.modUrl && (
                  <a
                    href={mod.modUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex shrink-0 items-center gap-1 text-xs text-white/55 transition-colors hover:text-[var(--blue-bright)]"
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
