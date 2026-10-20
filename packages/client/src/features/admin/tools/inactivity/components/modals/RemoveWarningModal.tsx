import { ConfirmDialog } from "@/components/confirm-dialog";
import { useStickyValue } from "@/hooks/use-sticky-value";
import { useMutationToast } from "@/hooks/use-mutation-toast";
import { trpc, type RouterOutput } from "@/lib/trpc";

type Warning = RouterOutput["admin"]["inactivity"]["list"]["warnings"][number];

interface RemoveWarningModalProps {
  warning: Warning | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function RemoveWarningModal({
  warning,
  onClose,
  onSuccess,
}: RemoveWarningModalProps) {
  const removeWarning = trpc.admin.inactivity.removeManual.useMutation(
    useMutationToast({
      success: "Player removed",
      error: (error) => error.message || "Failed to remove player",
      onSuccess,
    }),
  );
  const displayWarning = useStickyValue(warning);

  const displayName = displayWarning
    ? (displayWarning.minecraftUsername ??
      `UUID ${displayWarning.playerMinecraftUuid}`)
    : "";

  return (
    <ConfirmDialog
      open={warning !== null}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      title={<span className="text-destructive">Remove Player Now</span>}
      description={
        displayWarning && (
          <>
            This will immediately kick{" "}
            <span className="font-semibold">&quot;{displayName}&quot;</span>{" "}
            from Discord, remove them from all Minecraft server whitelists, and
            delete their player record. This action skips the remaining grace
            period and cannot be undone.
          </>
        )
      }
      confirmLabel="Remove Player"
      variant="destructive"
      confirmToken="REMOVE"
      onConfirm={() =>
        warning ? removeWarning.mutateAsync({ id: warning.id }) : undefined
      }
    >
      {displayWarning && (
        <div className="rounded-lg border border-border bg-muted/50 p-4">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Username:</span>
              <span className="font-medium">{displayName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Warned:</span>
              <span className="font-medium">
                {new Date(displayWarning.warnedAt).toLocaleDateString()}
              </span>
            </div>
            {displayWarning.lastSeen && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last seen:</span>
                <span className="font-medium">
                  {new Date(displayWarning.lastSeen).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </ConfirmDialog>
  );
}
