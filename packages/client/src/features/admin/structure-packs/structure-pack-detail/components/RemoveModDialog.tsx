import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { FormDialog } from "@/components/form-dialog";
import { useToastActions } from "@/hooks/use-toast";
import { trpc, queryClient } from "@/lib/trpc";
import type { RemoveTarget } from "../types";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Spinner } from "@/components/ui/spinner";

interface PackMod {
  id: number;
  curseforgeModId: number;
  modName: string;
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

  const [removeDepOverrides, setRemoveDepOverrides] =
    useState<Set<number> | null>(null);
  const [removingBatch, setRemovingBatch] = useState(false);

  const checkRemoveDepsQuery = useQuery(
    trpc.admin.structurePacks.checkRemoveDeps.queryOptions(
      { packId, modId: target?.modId ?? 0 },
      { enabled: target !== null },
    ),
  );

  const defaultRemoveSelection = useMemo(() => {
    if (!checkRemoveDepsQuery.data) return new Set<number>();
    const safeIds = checkRemoveDepsQuery.data.deps
      .filter((d) => d.safe)
      .map((d) => d.modId);
    return new Set(safeIds);
  }, [checkRemoveDepsQuery.data]);

  const selectedRemoveDeps = removeDepOverrides ?? defaultRemoveSelection;

  const removeModMutation = useMutation(
    trpc.admin.structurePacks.removeMod.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries(
          trpc.admin.structurePacks.get.queryFilter({ id: packId }),
        );
        void queryClient.invalidateQueries(
          trpc.admin.structurePacks.list.pathFilter(),
        );
      },
    }),
  );

  const handleClose = () => {
    if (removingBatch) return;
    setRemoveDepOverrides(null);
    onOpenChange(false);
  };

  const handleBatchRemove = async () => {
    if (!target) return;
    setRemovingBatch(true);
    try {
      const deps = packMods.filter((m) =>
        selectedRemoveDeps.has(m.curseforgeModId),
      );
      const failures: string[] = [];
      for (const dep of deps) {
        try {
          await removeModMutation.mutateAsync({ packId, modId: dep.id });
        } catch (error) {
          failures.push(
            `${dep.modName}: ${error instanceof Error ? error.message : "Failed to remove mod"}`,
          );
        }
      }

      try {
        await removeModMutation.mutateAsync({ packId, modId: target.modId });
      } catch (error) {
        failures.push(
          `${target.modName}: ${error instanceof Error ? error.message : "Failed to remove mod"}`,
        );
      }

      const total = 1 + deps.length;
      const removed = total - failures.length;
      if (failures.length === 0) {
        toast.success(
          `Removed ${total} mod${total !== 1 ? "s" : ""} from pack`,
        );
      } else if (removed === 0) {
        toast.error(failures.join("; "));
        return;
      } else {
        toast.warning(
          failures.join("; "),
          `Removed ${removed} of ${total} mods`,
        );
      }
      setRemoveDepOverrides(null);
      onOpenChange(false);
    } finally {
      setRemovingBatch(false);
    }
  };

  return (
    <FormDialog
      open={target !== null}
      onClose={handleClose}
      title="Remove Mod"
      description="This will remove mod entries from the pack."
      confirmLabel={
        <>
          <Trash2 className="size-3.5" />
          Remove
          {selectedRemoveDeps.size > 0
            ? ` ${1 + selectedRemoveDeps.size} mods`
            : ""}
        </>
      }
      onConfirm={() => void handleBatchRemove()}
      disabled={checkRemoveDepsQuery.isLoading}
      loading={removingBatch}
      destructive
      contentClassName="sm:max-w-lg"
    >
      <div className="max-h-80 space-y-2 overflow-y-auto">
        {/* Target mod, always removed */}
        <div className="flex items-center gap-3 rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm">
          <Trash2 className="size-4 shrink-0 text-destructive" />
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium">{target?.modName}</div>
            <div className="truncate text-xs text-muted-foreground">
              {target?.fileName}
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
            <Spinner className="mr-2 size-4" />
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
    </FormDialog>
  );
}
