import { ConfirmDialog } from "@/components/confirm-dialog";
import { useStickyValue } from "@/hooks/use-sticky-value";
import { useToastActions } from "@/hooks/use-toast";
import { trpc, type RouterOutput } from "@/lib/trpc";

type Warning = RouterOutput["admin"]["inactivity"]["list"]["warnings"][number];

interface ResolveWarningModalProps {
  warning: Warning | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function ResolveWarningModal({
  warning,
  onClose,
  onSuccess,
}: ResolveWarningModalProps) {
  const toast = useToastActions();
  const resolveWarning = trpc.admin.inactivity.resolveManual.useMutation({
    onSuccess: () => {
      toast.success("Warning resolved");
      onSuccess();
    },
    onError: (error) =>
      toast.error(error.message || "Failed to resolve warning"),
  });
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
      title="Resolve Inactivity Warning"
      description={
        displayWarning && (
          <>
            Mark{" "}
            <span className="font-semibold">&quot;{displayName}&quot;</span> as
            returned? The warning will be closed and they will not be removed by
            the next cleanup cycle.
          </>
        )
      }
      confirmLabel="Resolve"
      onConfirm={() =>
        warning ? resolveWarning.mutateAsync({ id: warning.id }) : undefined
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
