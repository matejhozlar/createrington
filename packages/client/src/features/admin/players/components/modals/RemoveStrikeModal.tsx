import { useState } from "react";
import { Field, FieldLabel } from "@/components/ui/field";
import { useToastActions } from "@/hooks/use-toast";
import { trpc } from "@/lib/trpc";
import { AdminActionModal } from "./AdminActionModal";

interface RemoveStrikeModalProps {
  open: boolean;
  onClose: () => void;
  playerId: string; // minecraftUuid
  strikeId: number;
  onSuccess: () => void; // call onRefresh from parent
}

export function RemoveStrikeModal({
  open,
  onClose,
  playerId,
  strikeId,
  onSuccess,
}: RemoveStrikeModalProps) {
  const toast = useToastActions();
  const removeStrike = trpc.admin.players.strikes.remove.useMutation();

  const [reason, setReason] = useState("");

  const handleSubmit = async () => {
    if (!reason.trim()) return;

    try {
      await removeStrike.mutateAsync({
        id: playerId,
        strikeId,
        reason: reason.trim(),
      });

      toast.success("Strike removed");
      setReason("");
      onClose();
      onSuccess();
    } catch {
      toast.error("Failed to remove strike");
    }
  };

  return (
    <AdminActionModal
      open={open}
      onClose={onClose}
      title="Remove Strike"
      onConfirm={handleSubmit}
      confirmLabel="Remove Strike"
      loading={removeStrike.isPending}
      disabled={!reason.trim()}
    >
      <Field>
        <FieldLabel htmlFor="remove-strike-reason">Reason</FieldLabel>
        <textarea
          id="remove-strike-reason"
          placeholder="Explain why this strike is being removed..."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          rows={4}
        />
      </Field>
    </AdminActionModal>
  );
}
