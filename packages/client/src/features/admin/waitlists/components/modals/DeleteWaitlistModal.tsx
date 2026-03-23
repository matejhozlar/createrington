import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
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
import { X } from "lucide-react";
import { useToastActions } from "@/hooks/use-toast";
import { trpc, type RouterOutput } from "@/lib/trpc";

type WaitlistEntry =
  RouterOutput["admin"]["waitlists"]["list"]["entries"][number];

interface DeleteWaitlistModalProps {
  open: boolean;
  onClose: () => void;
  entry: WaitlistEntry;
  onSuccess: () => void;
}

export function DeleteWaitlistModal({
  open,
  onClose,
  entry,
  onSuccess,
}: DeleteWaitlistModalProps) {
  const toast = useToastActions();

  const deleteEntry = trpc.admin.waitlists.delete.useMutation();

  const [reason, setReason] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  if (!open) return null;

  const handleDeleteClick = () => {
    if (!reason.trim()) {
      toast.error("Reason is required for deletion");
      return;
    }
    setShowConfirmDialog(true);
  };

  const handleConfirmDelete = async () => {
    if (confirmText !== "DELETE") {
      toast.error('You must type "DELETE" to confirm');
      return;
    }

    try {
      await deleteEntry.mutateAsync({
        id: entry.id,
        reason: reason.trim(),
      });

      toast.success("Waitlist entry deleted");
      setShowConfirmDialog(false);
      setConfirmText("");
      onSuccess();
    } catch {
      toast.error("Failed to delete waitlist entry");
    } finally {
      onClose();
    }
  };

  const handleCancelConfirm = () => {
    setShowConfirmDialog(false);
    setConfirmText("");
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      >
        <div className="w-full max-w-md rounded-lg border border-destructive bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-destructive">
              Delete Waitlist Entry
            </h3>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="cursor-pointer"
            >
              <X className="size-4" />
            </Button>
          </div>

          <p className="mb-4 text-sm text-muted-foreground">
            This will permanently delete the waitlist entry for{" "}
            <span className="font-semibold">
              {entry.email || entry.discordName}
            </span>
            {entry.email ? ` (${entry.discordName})` : ""}. This action cannot
            be undone.
          </p>

          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/50 p-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Entry ID:</span>
                  <span className="font-medium">#{entry.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email:</span>
                  <span className="font-medium">{entry.email || "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Discord:</span>
                  <span className="font-medium">{entry.discordName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <span className="font-medium">{entry.status}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Submitted:</span>
                  <span className="font-medium">
                    {new Date(entry.submittedAt).toLocaleDateString()}
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

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 cursor-pointer"
                onClick={onClose}
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
            </div>
          </div>
        </div>
      </div>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
            <AlertDialogDescription>
              This action is permanent and cannot be undone. Type{" "}
              <span className="font-semibold">DELETE</span> to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <Field>
            <Input
              type="text"
              placeholder="Type DELETE to confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoFocus
            />
          </Field>

          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={handleCancelConfirm}
              className="cursor-pointer"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              className="cursor-pointer"
              onClick={handleConfirmDelete}
              disabled={confirmText !== "DELETE" || deleteEntry.isPending}
            >
              {deleteEntry.isPending ? "Deleting..." : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
