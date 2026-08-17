import { useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { trpc, type RouterOutput } from "@/lib/trpc";
import { useToastActions } from "@/hooks/use-toast";
import { AdminActionModal } from "./AdminActionModal";

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
  const utils = trpc.useUtils();

  const deletePlayer = trpc.admin.players.players.delete.useMutation({
    onError: () => toast.error("Failed to delete player"),
  });

  const [reason, setReason] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const handleDeleteClick = () => {
    if (!reason.trim()) {
      toast.error("Reason is required for deletion");
      return;
    }
    setShowConfirmDialog(true);
  };

  const handleConfirmDelete = async () => {
    await deletePlayer.mutateAsync({
      id: player.minecraftUuid,
      reason: reason.trim(),
    });
    await utils.admin.players.players.list.invalidate();
    toast.success("Player deleted");
    onSuccess();
    onClose();
  };

  return (
    <>
      <AdminActionModal
        open={open}
        onClose={onClose}
        title="Delete Player"
        description={
          <>
            This will permanently delete all data for{" "}
            <span className="font-semibold">{player.minecraftUsername}</span>{" "}
            including balance, sessions, tickets, and strikes. This action
            cannot be undone.
          </>
        }
        onConfirm={handleDeleteClick}
        confirmLabel="Delete Player"
        loadingLabel="Deleting..."
        loading={deletePlayer.isPending}
        disabled={!reason.trim()}
        destructive
      >
        <div className="rounded-lg border border-border bg-muted/50 p-4">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Username:</span>
              <span className="font-medium">{player.minecraftUsername}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">UUID:</span>
              <span className="font-mono text-xs">{player.minecraftUuid}</span>
            </div>
            {player.discordId && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Discord ID:</span>
                <span className="font-mono text-xs">{player.discordId}</span>
              </div>
            )}
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
          />
        </Field>
      </AdminActionModal>

      <ConfirmDialog
        open={showConfirmDialog}
        onOpenChange={(isOpen) => {
          setShowConfirmDialog(isOpen);
          if (!isOpen) setConfirmText("");
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
        onConfirm={handleConfirmDelete}
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
