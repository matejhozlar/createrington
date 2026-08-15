import { useState } from "react";
import { Field, FieldLabel } from "@/components/ui/field";
import { trpc } from "@/lib/trpc";
import { useToastActions } from "@/hooks/use-toast";
import { AdminActionModal } from "./AdminActionModal";

interface LiftWorkshopBanModalProps {
  open: boolean;
  onClose: () => void;
  banId: number;
  onSuccess: () => void;
}

export function LiftWorkshopBanModal({
  open,
  onClose,
  banId,
  onSuccess,
}: LiftWorkshopBanModalProps) {
  const toast = useToastActions();
  const liftBan = trpc.admin.workshops.bans.lift.useMutation();

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
      onSuccess();
      handleClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to lift the block",
      );
    }
  };

  return (
    <AdminActionModal
      open={open}
      onClose={handleClose}
      title="Lift suggestion block"
      description="The user will be able to submit new mod suggestions again."
      onConfirm={handleSubmit}
      confirmLabel="Lift Block"
      loadingLabel="Lifting..."
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
        <textarea
          id="lift-workshop-ban-reason"
          placeholder="Enter reason for lifting the block..."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          rows={4}
        />
      </Field>
    </AdminActionModal>
  );
}
