import { ConfirmDialog } from "@/components/confirm-dialog";
import { useMutationToast } from "@/hooks/use-mutation-toast";
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
  const resolveWarning = trpc.admin.inactivity.resolveManual.useMutation(
    useMutationToast({
      success: "Warning resolved",
      error: (error) => error.message || "Failed to resolve warning",
      onSuccess: () => {
        onSuccess();
      },
    }),
  );

  const displayName = warning
    ? (warning.minecraftUsername ?? `UUID ${warning.playerMinecraftUuid}`)
    : "";

  return (
    <ConfirmDialog
      open={warning !== null}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      title="Resolve Inactivity Warning"
      description={
        warning && (
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
      {warning && (
        <div className="rounded-lg border border-border bg-muted/50 p-4">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Username:</span>
              <span className="font-medium">{displayName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Warned:</span>
              <span className="font-medium">
                {new Date(warning.warnedAt).toLocaleDateString()}
              </span>
            </div>
            {warning.lastSeen && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last seen:</span>
                <span className="font-medium">
                  {new Date(warning.lastSeen).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </ConfirmDialog>
  );
}
