import { useState } from "react";
import { ADMIN_REASON_MAX_LENGTH } from "@createrington/shared/admin-reason";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useStickyValue } from "@/hooks/use-sticky-value";
import { useToastActions } from "@/hooks/use-toast";
import { useMutationToast } from "@/hooks/use-mutation-toast";
import { trpc, type RouterOutput } from "@/lib/trpc";

type WaitlistEntry =
  RouterOutput["admin"]["waitlists"]["list"]["entries"][number];

interface DeleteWaitlistModalProps {
  entry: WaitlistEntry | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function DeleteWaitlistModal({
  entry,
  onClose,
  onSuccess,
}: DeleteWaitlistModalProps) {
  const toast = useToastActions();

  const [reason, setReason] = useState("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const deleteEntry = trpc.admin.waitlists.delete.useMutation(
    useMutationToast({
      success: "Waitlist entry deleted",
      error: "Failed to delete waitlist entry",
      onSuccess: () => {
        setReason("");
        onSuccess();
        onClose();
      },
    }),
  );

  const displayEntry = useStickyValue(entry);

  const handleClose = () => {
    setReason("");
    setShowConfirmDialog(false);
    onClose();
  };

  const handleDeleteClick = () => {
    if (!reason.trim()) {
      toast.error("Reason is required for deletion");
      return;
    }
    setShowConfirmDialog(true);
  };

  return (
    <>
      <Dialog
        open={entry !== null}
        onOpenChange={(open) => {
          if (!open) handleClose();
        }}
      >
        <DialogContent className="border-destructive">
          <DialogHeader>
            <DialogTitle className="text-destructive">
              Delete Waitlist Entry
            </DialogTitle>
            <DialogDescription>
              This will permanently delete the waitlist entry for{" "}
              <span className="font-semibold">
                {displayEntry?.discordUsername}
              </span>
              . This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/50 p-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Entry ID:</span>
                  <span className="font-medium">#{displayEntry?.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Discord:</span>
                  <span className="font-medium">
                    {displayEntry?.discordUsername}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Discord ID:</span>
                  <span className="font-medium">{displayEntry?.discordId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <span className="font-medium">{displayEntry?.status}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Signed up:</span>
                  <span className="font-medium">
                    {displayEntry
                      ? new Date(displayEntry.createdAt).toLocaleDateString()
                      : ""}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Queued:</span>
                  <span className="font-medium">
                    {displayEntry
                      ? new Date(displayEntry.queuedAt).toLocaleDateString()
                      : ""}
                  </span>
                </div>
              </div>
            </div>

            <Field>
              <FieldLabel htmlFor="delete-reason">
                Reason for Deletion
              </FieldLabel>
              <Input
                id="delete-reason"
                type="text"
                placeholder="Enter reason for deletion"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={ADMIN_REASON_MAX_LENGTH}
              />
            </Field>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              className="flex-1 cursor-pointer"
              onClick={handleClose}
              disabled={deleteEntry.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="flex-1 cursor-pointer"
              onClick={handleDeleteClick}
              disabled={!reason.trim() || deleteEntry.isPending}
            >
              Delete Entry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={showConfirmDialog}
        onOpenChange={setShowConfirmDialog}
        title="Confirm Deletion"
        description="This action is permanent and cannot be undone."
        confirmLabel="Confirm"
        variant="destructive"
        confirmToken="DELETE"
        onConfirm={() =>
          entry
            ? deleteEntry.mutateAsync({ id: entry.id, reason: reason.trim() })
            : undefined
        }
      />
    </>
  );
}
