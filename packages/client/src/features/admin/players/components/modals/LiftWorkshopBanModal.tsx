import { useState } from "react";
import { Field, FieldLabel } from "@/components/ui/field";
import { trpc, queryClient } from "@/lib/trpc";
import { useToastActions } from "@/hooks/use-toast";
import { FormDialog } from "@/components/form-dialog";
import { useMutation } from "@tanstack/react-query";
import { Textarea } from "@/components/ui/textarea";

interface LiftWorkshopBanModalProps {
  open: boolean;
  onClose: () => void;
  banId: number;
}

export function LiftWorkshopBanModal({
  open,
  onClose,
  banId,
}: LiftWorkshopBanModalProps) {
  const toast = useToastActions();
  const liftBan = useMutation(
    trpc.admin.workshops.bans.lift.mutationOptions({
      onSuccess: () =>
        void queryClient.invalidateQueries(
          trpc.admin.workshops.bans.pathFilter(),
        ),
    }),
  );

  const [reason, setReason] = useState("");

  const handleClose = () => {
    setReason("");
    onClose();
  };

  const handleSubmit = async () => {
    if (!reason.trim()) {
      toast.error("Reason is required");
      return;
    }

    try {
      await liftBan.mutateAsync({ banId, reason: reason.trim() });
      toast.success("Suggestion block lifted");
      handleClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to lift the block",
      );
    }
  };

  return (
    <FormDialog
      open={open}
      onClose={handleClose}
      title="Lift suggestion block"
      description="The user will be able to submit new mod suggestions again."
      onConfirm={handleSubmit}
      confirmLabel="Lift Block"
      loading={liftBan.isPending}
      disabled={!reason.trim()}
    >
      <div className="rounded-lg border border-border bg-muted/50 p-3">
        <p className="text-sm">
          <span className="text-muted-foreground">Ban ID:</span>{" "}
          <span className="font-mono font-medium">#{banId}</span>
        </p>
      </div>

      <Field>
        <FieldLabel htmlFor="lift-workshop-ban-reason">
          Reason for Lifting
        </FieldLabel>
        <Textarea
          id="lift-workshop-ban-reason"
          placeholder="Enter reason for lifting the block..."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={4}
          maxLength={500}
        />
      </Field>
    </FormDialog>
  );
}
