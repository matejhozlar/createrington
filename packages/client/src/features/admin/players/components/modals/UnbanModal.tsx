import { useState } from "react";
import { ADMIN_REASON_MAX_LENGTH } from "@createrington/shared/admin-reason";
import { Field, FieldLabel } from "@/components/ui/field";
import { trpc, queryClient } from "@/lib/trpc";
import { useToastActions } from "@/hooks/use-toast";
import { FormDialog } from "@/components/form-dialog";
import { useMutation } from "@tanstack/react-query";
import { Textarea } from "@/components/ui/textarea";

interface UnbanModalProps {
  open: boolean;
  onClose: () => void;
  banId: number;
}

export function UnbanModal({ open, onClose, banId }: UnbanModalProps) {
  const toast = useToastActions();
  const unbanPlayer = useMutation(
    trpc.admin.players.bans.unban.mutationOptions({
      onSuccess: () =>
        void queryClient.invalidateQueries(trpc.admin.players.pathFilter()),
    }),
  );

  const [reason, setReason] = useState("");

  const handleSubmit = async () => {
    if (!reason.trim()) {
      toast.error("Reason is required");
      return;
    }

    try {
      await unbanPlayer.mutateAsync({
        banId,
        reason: reason.trim(),
      });

      toast.success("Ban lifted");

      setReason("");
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Something went wrong",
        "Failed to unban player",
      );
    }
  };

  const handleClose = () => {
    setReason("");
    onClose();
  };

  return (
    <FormDialog
      open={open}
      onClose={handleClose}
      title="Unban Player"
      description="This will lift the ban and allow the player to rejoin the server."
      onConfirm={handleSubmit}
      confirmLabel="Unban Player"
      loading={unbanPlayer.isPending}
      disabled={!reason.trim()}
    >
      <div className="rounded-lg border border-border bg-muted/50 p-3">
        <p className="text-sm">
          <span className="text-muted-foreground">Ban ID:</span>{" "}
          <span className="font-mono font-medium">#{banId}</span>
        </p>
      </div>

      <Field>
        <FieldLabel htmlFor="unban-reason">Reason for Unbanning</FieldLabel>
        <Textarea
          id="unban-reason"
          placeholder="Enter reason for lifting the ban..."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={ADMIN_REASON_MAX_LENGTH}
          rows={4}
        />
      </Field>
    </FormDialog>
  );
}
