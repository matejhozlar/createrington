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
import { cn } from "@/lib/utils";
import { trpc, type RouterOutput } from "@/lib/trpc";
import { useToastActions } from "@/hooks/use-toast";

type PlayerDetailed = RouterOutput["admin"]["players"]["players"]["get"];

interface DeletePlayerModalProps {
  open: boolean;
  onClose: () => void;
  player: PlayerDetailed["player"];
  onSuccess: () => void;
}

export function DeletePlayerModal({
  open,
  onClose,
  player,
  onSuccess,
}: DeletePlayerModalProps) {
  const toast = useToastActions();

  const deletePlayer = trpc.admin.players.players.delete.useMutation();

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
      await deletePlayer.mutateAsync({
        id: player.minecraftUuid,
        reason: reason.trim(),
      });

      toast.success("Player deleted successfully!");
      setShowConfirmDialog(false);
      setConfirmText("");
      onSuccess();
    } catch (err) {
      console.error("Failed to delete player:", err);
      toast.error("Failed to delete player");
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
        className={cn(
          "fixed inset-0 z-50 flex items-center justify-center bg-black/50",
        )}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      >
        <div className="w-full max-w-md rounded-lg border border-destructive bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-destructive">
              Delete Player
            </h3>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="cursor-pointer"
              aria-label="Close"
            >
              <X className="size-4" />
            </Button>
          </div>

          <p className="mb-4 text-sm text-muted-foreground">
            This will permanently delete all data for{" "}
            <span className="font-semibold">{player.minecraftUsername}</span>{" "}
            including balance, sessions, tickets, and strikes. This action
            cannot be undone.
          </p>

          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/50 p-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Username:</span>
                  <span className="font-medium">
                    {player.minecraftUsername}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">UUID:</span>
                  <span className="font-mono text-xs">
                    {player.minecraftUuid}
                  </span>
                </div>
                {player.discordId && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Discord ID:</span>
                    <span className="font-mono text-xs">
                      {player.discordId}
                    </span>
                  </div>
                )}
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
                disabled={deletePlayer.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1 cursor-pointer"
                onClick={handleDeleteClick}
                disabled={!reason.trim() || deletePlayer.isPending}
              >
                Delete Player
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
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
              disabled={confirmText !== "DELETE" || deletePlayer.isPending}
            >
              {deletePlayer.isPending ? "Deleting..." : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
