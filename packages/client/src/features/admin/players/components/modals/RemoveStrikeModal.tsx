import { useState } from "react";
import { ADMIN_REASON_MAX_LENGTH } from "@createrington/shared/admin-reason";
import { Field, FieldLabel } from "@/components/ui/field";
import { useToastActions } from "@/hooks/use-toast";
import { trpc, queryClient } from "@/lib/trpc";
import { AdminActionModal } from "./AdminActionModal";
import { useMutation } from "@tanstack/react-query";
import { Textarea } from "@/components/ui/textarea";

interface RemoveStrikeModalProps {
  open: boolean;
  onClose: () => void;
  playerId: string; // minecraftUuid
  strikeId: number;
}

export function RemoveStrikeModal({
  open,
  onClose,
  playerId,
  strikeId,
}: RemoveStrikeModalProps) {
  const toast = useToastActions();
  const removeStrike = useMutation(
    trpc.admin.players.strikes.remove.mutationOptions({
      onSuccess: () =>
        void queryClient.invalidateQueries(trpc.admin.players.pathFilter()),
    }),
  );

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
        <Textarea
          id="remove-strike-reason"
          placeholder="Explain why this strike is being removed..."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={ADMIN_REASON_MAX_LENGTH}
          rows={4}
        />
      </Field>
    </AdminActionModal>
  );
}
