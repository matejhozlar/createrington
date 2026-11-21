import { useState } from "react";
import { ADMIN_REASON_MAX_LENGTH } from "@createrington/shared/admin-reason";
import { Field, FieldLabel } from "@/components/ui/field";
import { useMutationToast } from "@/hooks/use-mutation-toast";
import { trpc, queryClient } from "@/lib/trpc";
import { FormDialog } from "@/components/form-dialog";
import { useMutation } from "@tanstack/react-query";
import { Textarea } from "@/components/ui/textarea";

interface RemoveStrikeModalProps {
  open: boolean;
  onClose: () => void;
  playerId: string;
  strikeId: number;
}

export function RemoveStrikeModal({
  open,
  onClose,
  playerId,
  strikeId,
}: RemoveStrikeModalProps) {
  const [reason, setReason] = useState("");

  const removeStrike = useMutation(
    trpc.admin.players.strikes.delete.mutationOptions(
      useMutationToast({
        success: "Strike removed",
        onSuccess: () => {
          void queryClient.invalidateQueries(trpc.admin.players.pathFilter());
          setReason("");
          onClose();
        },
      }),
    ),
  );

  const handleSubmit = () => {
    if (!reason.trim()) return;

    removeStrike.mutate({
      id: playerId,
      strikeId,
      reason: reason.trim(),
    });
  };

  return (
    <FormDialog
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
    </FormDialog>
  );
}
