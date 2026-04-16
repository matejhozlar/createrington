import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useToastActions } from "@/hooks/use-toast";
import { trpc, type RouterOutput } from "@/lib/trpc";

type Warning = RouterOutput["admin"]["inactivity"]["list"]["warnings"][number];

interface RemoveWarningModalProps {
  open: boolean;
  onClose: () => void;
  warning: Warning;
  onSuccess: () => void;
}

const CONFIRM_TOKEN = "REMOVE";

export function RemoveWarningModal({
  open,
  onClose,
  warning,
  onSuccess,
}: RemoveWarningModalProps) {
  const toast = useToastActions();
  const [confirmText, setConfirmText] = useState("");
  const removeWarning = trpc.admin.inactivity.removeManual.useMutation();

  const displayName =
    warning.minecraftUsername ?? `UUID ${warning.playerMinecraftUuid}`;
  const canConfirm = confirmText === CONFIRM_TOKEN;

  const handleClose = () => {
    setConfirmText("");
    onClose();
  };

  const handleRemove = async () => {
    try {
      await removeWarning.mutateAsync({ id: warning.id });
      toast.success("Player removed");
      setConfirmText("");
      onSuccess();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to remove player",
      );
    }
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(isOpen) => !isOpen && handleClose()}
    >
      <AlertDialogContent className="border-destructive">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-destructive">
            Remove Player Now
          </AlertDialogTitle>
          <AlertDialogDescription>
            This will immediately kick{" "}
            <span className="font-semibold">&quot;{displayName}&quot;</span>{" "}
            from Discord, remove them from all Minecraft server whitelists, and
            delete their player record. This action skips the remaining grace
            period and cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

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

        <Field>
          <FieldLabel htmlFor="remove-confirm">
            Type{" "}
            <span className="font-mono font-semibold">{CONFIRM_TOKEN}</span> to
            confirm
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

        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleClose}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={handleRemove}
            disabled={!canConfirm || removeWarning.isPending}
          >
            {removeWarning.isPending ? "Removing..." : "Remove Player"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
