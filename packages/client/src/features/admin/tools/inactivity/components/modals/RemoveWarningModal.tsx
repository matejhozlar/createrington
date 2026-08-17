import { useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useStickyValue } from "@/hooks/use-sticky-value";
import { useToastActions } from "@/hooks/use-toast";
import { trpc, type RouterOutput } from "@/lib/trpc";

type Warning = RouterOutput["admin"]["inactivity"]["list"]["warnings"][number];

interface RemoveWarningModalProps {
  warning: Warning | null;
  onClose: () => void;
  onSuccess: () => void;
}

const CONFIRM_TOKEN = "REMOVE";

export function RemoveWarningModal({
  warning,
  onClose,
  onSuccess,
}: RemoveWarningModalProps) {
  const toast = useToastActions();
  const [confirmText, setConfirmText] = useState("");
  const removeWarning = trpc.admin.inactivity.removeManual.useMutation({
    onSuccess: () => {
      toast.success("Player removed");
      setConfirmText("");
      onSuccess();
    },
    onError: (error) => toast.error(error.message || "Failed to remove player"),
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
        if (!isOpen) {
          setConfirmText("");
          onClose();
        }
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
      confirmDisabled={confirmText !== CONFIRM_TOKEN}
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
      <Field>
        <FieldLabel htmlFor="remove-confirm">
          Type <span className="font-mono font-semibold">{CONFIRM_TOKEN}</span>{" "}
          to confirm
        </FieldLabel>
        <Input
          id="remove-confirm"
          type="text"
          placeholder={CONFIRM_TOKEN}
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          autoFocus
        />
      </Field>
    </ConfirmDialog>
  );
}
