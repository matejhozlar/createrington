import { Field, FieldLabel } from "@/components/ui/field";
import { trpc, queryClient } from "@/lib/trpc";
import { useMutationToast } from "@/hooks/use-mutation-toast";
import { useDialogDraft } from "@/hooks/use-dialog-draft";
import { FormDialog } from "@/components/form-dialog";
import { useMutation } from "@tanstack/react-query";
import { Textarea } from "@/components/ui/textarea";

interface LiftWorkshopBanModalProps {
  banId: number | null;
  onClose: () => void;
}

export function LiftWorkshopBanModal({
  banId,
  onClose,
}: LiftWorkshopBanModalProps) {
  const open = banId !== null;
  const [{ reason }, update] = useDialogDraft(open, () => ({ reason: "" }));

  const liftBan = useMutation(
    trpc.admin.workshops.bans.lift.mutationOptions(
      useMutationToast({
        success: "Suggestion block lifted",
        onSuccess: () => {
          void queryClient.invalidateQueries(
            trpc.admin.workshops.bans.pathFilter(),
          );
          onClose();
        },
      }),
    ),
  );

  const handleSubmit = () => {
    if (banId === null) return;
    liftBan.mutate({ banId, reason: reason.trim() });
  };

  return (
    <FormDialog
      open={open}
      onClose={onClose}
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
          onChange={(e) => update({ reason: e.target.value })}
          rows={4}
          maxLength={500}
        />
      </Field>
    </FormDialog>
  );
}
