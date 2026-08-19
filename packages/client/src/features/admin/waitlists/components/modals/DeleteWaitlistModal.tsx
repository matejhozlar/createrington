import { useState } from "react";
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
  const [confirmText, setConfirmText] = useState("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const deleteEntry = trpc.admin.waitlists.delete.useMutation({
    onSuccess: () => {
      toast.success("Waitlist entry deleted");
      setReason("");
      setConfirmText("");
      onSuccess();
      onClose();
    },
    onError: () => toast.error("Failed to delete waitlist entry"),
  });

  const displayEntry = useStickyValue(entry);

  const handleClose = () => {
    setReason("");
    setConfirmText("");
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
        onOpenChange={(open) => {
          setShowConfirmDialog(open);
          if (!open) setConfirmText("");
        }}
        title="Confirm Deletion"
        description={
          <>
            This action is permanent and cannot be undone. Type{" "}
            <span className="font-semibold">DELETE</span> to confirm.
          </>
        }
        confirmLabel="Confirm"
        variant="destructive"
        confirmDisabled={confirmText !== "DELETE"}
        onConfirm={() =>
          entry
            ? deleteEntry.mutateAsync({ id: entry.id, reason: reason.trim() })
            : undefined
        }
      >
        <Field>
          <Input
            type="text"
            placeholder="Type DELETE to confirm"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            autoFocus
          />
        </Field>
      </ConfirmDialog>
    </>
  );
}
