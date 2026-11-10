import { useState } from "react";
import { ADMIN_REASON_MAX_LENGTH } from "@createrington/shared/admin-reason";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { FormDialog } from "@/components/form-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useToastActions } from "@/hooks/use-toast";
import { useMutationToast } from "@/hooks/use-mutation-toast";
import { trpc, queryClient, type RouterOutput } from "@/lib/trpc";
import { useMutation } from "@tanstack/react-query";

type WaitlistEntry =
  RouterOutput["admin"]["waitlists"]["list"]["entries"][number];

interface DeleteWaitlistModalProps {
  entry: WaitlistEntry | null;
  onClose: () => void;
}

export function DeleteWaitlistModal({
  entry,
  onClose,
}: DeleteWaitlistModalProps) {
  const toast = useToastActions();

  const [reason, setReason] = useState("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const deleteEntry = useMutation(
    trpc.admin.waitlists.delete.mutationOptions(
      useMutationToast({
        success: "Waitlist entry deleted",
        error: "Failed to delete waitlist entry",
        onSuccess: () => {
          setReason("");
          void queryClient.invalidateQueries(trpc.admin.waitlists.pathFilter());
          onClose();
        },
      }),
    ),
  );

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
      <FormDialog
        open={entry !== null}
        onClose={handleClose}
        title="Delete Waitlist Entry"
        description={
          <>
            This will permanently delete the waitlist entry for{" "}
            <span className="font-semibold">{entry?.discordUsername}</span>.
            This action cannot be undone.
          </>
        }
        confirmLabel="Delete Entry"
        onConfirm={handleDeleteClick}
        disabled={!reason.trim() || deleteEntry.isPending}
        destructive
        contentClassName="sm:max-w-lg"
      >
        <div className="rounded-lg border border-border bg-muted/50 p-4">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Entry ID:</span>
              <span className="font-medium">#{entry?.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Discord:</span>
              <span className="font-medium">{entry?.discordUsername}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Discord ID:</span>
              <span className="font-medium">{entry?.discordId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status:</span>
              <span className="font-medium">{entry?.status}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Signed up:</span>
              <span className="font-medium">
                {entry ? new Date(entry.createdAt).toLocaleDateString() : ""}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Queued:</span>
              <span className="font-medium">
                {entry ? new Date(entry.queuedAt).toLocaleDateString() : ""}
              </span>
            </div>
          </div>
        </div>

        <Field>
          <FieldLabel htmlFor="delete-reason">Reason for Deletion</FieldLabel>
          <Input
            id="delete-reason"
            type="text"
            placeholder="Enter reason for deletion"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={ADMIN_REASON_MAX_LENGTH}
          />
        </Field>
      </FormDialog>

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
