import { useMemo, useState } from "react";
import { useStickyValue } from "@/hooks/use-sticky-value";
import { AlertTriangle, CheckCircle2, Loader2, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToastActions } from "@/hooks/use-toast";
import { trpc } from "@/lib/trpc";
import type { RemoveTarget } from "../types";

interface PackMod {
  id: number;
  curseforgeModId: number;
}

export function RemoveModDialog({
  target,
  onOpenChange,
  packId,
  packMods,
}: {
  /** The mod to remove, or null to keep the dialog closed */
  target: RemoveTarget | null;
  onOpenChange: (open: boolean) => void;
  packId: number;
  packMods: PackMod[];
}) {
  const toast = useToastActions();
  const utils = trpc.useUtils();

  const [removeDepOverrides, setRemoveDepOverrides] =
    useState<Set<number> | null>(null);
  const [removingBatch, setRemovingBatch] = useState(false);

  const displayTarget = useStickyValue(target);

  const checkRemoveDepsQuery =
    trpc.admin.structurePacks.checkRemoveDeps.useQuery(
      { packId, modId: target?.modId ?? 0 },
      { enabled: target !== null },
    );

  const defaultRemoveSelection = useMemo(() => {
    if (!checkRemoveDepsQuery.data) return new Set<number>();
    const safeIds = checkRemoveDepsQuery.data.deps
      .filter((d) => d.safe)
      .map((d) => d.modId);
    return new Set(safeIds);
  }, [checkRemoveDepsQuery.data]);

  const selectedRemoveDeps = removeDepOverrides ?? defaultRemoveSelection;

  const removeModMutation = trpc.admin.structurePacks.removeMod.useMutation({
    onSuccess: () => {
      utils.admin.structurePacks.get.invalidate({ id: packId });
      utils.admin.structurePacks.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleDialogOpenChange = (next: boolean) => {
    if (!next && !removingBatch) {
      setRemoveDepOverrides(null);
      onOpenChange(false);
    }
  };

  /**
   * Removes the targeted mod and any checked safe dependencies from the pack.
   *
   * Dependencies are removed first so the target mod's removal doesn't cause
   * constraint issues. Failures on individual dep removals are swallowed.
   */
  const handleBatchRemove = async () => {
    if (!target) return;
    setRemovingBatch(true);
    try {
      for (const depModId of selectedRemoveDeps) {
        const packMod = packMods.find((m) => m.curseforgeModId === depModId);
        if (!packMod) continue;
        try {
          await removeModMutation.mutateAsync({
            packId,
            modId: packMod.id,
          });
        } catch {
          // Swallow individual dep failures so other removals still run
        }
      }

      await removeModMutation.mutateAsync({
        packId,
        modId: target.modId,
      });

      const count = 1 + selectedRemoveDeps.size;
      toast.success(`Removed ${count} mod${count !== 1 ? "s" : ""} from pack`);
      setRemoveDepOverrides(null);
      onOpenChange(false);
    } finally {
      setRemovingBatch(false);
    }
  };

  return (
    <Dialog open={target !== null} onOpenChange={handleDialogOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove Mod</DialogTitle>
          <DialogDescription>
            This will remove mod entries from the pack.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-80 space-y-2 overflow-y-auto">
          {/* Target mod, always removed */}
          <div className="flex items-center gap-3 rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm">
            <Trash2 className="size-4 shrink-0 text-destructive" />
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">
                {displayTarget?.modName}
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {displayTarget?.fileName}
              </div>
            </div>
          </div>

          {/* Dependents warning: other pack mods that need this mod */}
          {checkRemoveDepsQuery.data &&
            checkRemoveDepsQuery.data.dependents.length > 0 && (
              <div className="flex items-start gap-3 rounded-md border border-yellow-500/50 bg-yellow-500/5 p-3 text-sm">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-yellow-500" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-yellow-500">
                    Other mods depend on this
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {checkRemoveDepsQuery.data.dependents
                      .map((d) => d.modName)
                      .join(", ")}
                  </div>
                </div>
              </div>
            )}

          {checkRemoveDepsQuery.isLoading && (
            <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
              <Loader2 className="mr-2 size-4 animate-spin" />
              Checking dependencies...
            </div>
          )}

          {checkRemoveDepsQuery.data &&
            checkRemoveDepsQuery.data.deps.length === 0 &&
            checkRemoveDepsQuery.data.dependents.length === 0 && (
              <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
                <CheckCircle2 className="mr-2 size-4 text-green-500" />
                No dependency conflicts, safe to remove.
              </div>
            )}

          {checkRemoveDepsQuery.data &&
            checkRemoveDepsQuery.data.deps.length === 0 &&
            checkRemoveDepsQuery.data.dependents.length > 0 && (
              <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
                No removable dependencies.
              </div>
            )}

          {checkRemoveDepsQuery.data?.deps.map((dep) => (
            <div
              key={dep.modId}
              className={`flex items-center gap-3 rounded-md border p-3 text-sm${dep.safe ? " hover:bg-accent" : ""}`}
            >
              <div className="shrink-0">
                {dep.safe ? (
                  <Checkbox
                    checked={selectedRemoveDeps.has(dep.modId)}
                    disabled={removingBatch}
                    onCheckedChange={() =>
                      setRemoveDepOverrides((prev) => {
                        const current = prev ?? defaultRemoveSelection;
                        const next = new Set(current);
                        if (next.has(dep.modId)) next.delete(dep.modId);
                        else next.add(dep.modId);
                        return next;
                      })
                    }
                  />
                ) : (
                  <div className="size-4" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 font-medium">
                  <span className="truncate">{dep.modName}</span>
                  {dep.safe ? (
                    <Badge variant="secondary" className="text-xs">
                      Unused
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs">
                      In use
                    </Badge>
                  )}
                </div>
                {!dep.safe && dep.neededBy.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    Needed by {dep.neededBy.join(", ")}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button
            variant="destructive"
            onClick={handleBatchRemove}
            disabled={checkRemoveDepsQuery.isLoading}
            loading={removingBatch}
          >
            <Trash2 className="size-3.5" />
            Remove
            {selectedRemoveDeps.size > 0
              ? ` ${1 + selectedRemoveDeps.size} mods`
              : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
