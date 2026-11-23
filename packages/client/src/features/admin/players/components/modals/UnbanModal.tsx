import { ADMIN_REASON_MAX_LENGTH } from "@createrington/shared/admin-reason";
import { Field, FieldLabel } from "@/components/ui/field";
import { trpc, queryClient } from "@/lib/trpc";
import { useMutationToast } from "@/hooks/use-mutation-toast";
import { useDialogDraft } from "@/hooks/use-dialog-draft";
import { FormDialog } from "@/components/form-dialog";
import { useMutation } from "@tanstack/react-query";
import { Textarea } from "@/components/ui/textarea";

interface UnbanModalProps {
  banId: number | null;
  onClose: () => void;
}

export function UnbanModal({ banId, onClose }: UnbanModalProps) {
  const open = banId !== null;
  const [{ reason }, update] = useDialogDraft(open, () => ({ reason: "" }));

  const unbanPlayer = useMutation(
    trpc.admin.players.bans.unban.mutationOptions(
      useMutationToast({
        success: "Ban lifted",
        error: (err) => ({
          title: "Failed to unban player",
          description: err.message,
        }),
        onSuccess: () => {
          void queryClient.invalidateQueries(trpc.admin.players.pathFilter());
          onClose();
        },
      }),
    ),
  );

  const handleSubmit = () => {
    if (banId === null) return;
    unbanPlayer.mutate({
      banId,
      reason: reason.trim(),
    });
  };

  return (
    <FormDialog
      open={open}
      onClose={onClose}
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
          onChange={(e) => update({ reason: e.target.value })}
          maxLength={ADMIN_REASON_MAX_LENGTH}
          rows={4}
        />
      </Field>
    </FormDialog>
  );
}
