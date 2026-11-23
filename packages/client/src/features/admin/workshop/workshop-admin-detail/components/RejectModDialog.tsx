import { FormDialog } from "@/components/form-dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  WORKSHOP_MOD_REJECT_REASONS,
  WORKSHOP_MOD_REJECT_REASON_LABELS,
} from "@createrington/shared/workshop";
import { useDialogDraft } from "@/hooks/use-dialog-draft";
import { Field, FieldLabel } from "@/components/ui/field";

type RejectReason = (typeof WORKSHOP_MOD_REJECT_REASONS)[number];

export function RejectModDialog({
  target,
  onOpenChange,
  onReject,
  pending,
}: {
  target: { workshopModId: number; name: string } | null;
  onOpenChange: (open: boolean) => void;
  onReject: (input: {
    workshopModId: number;
    reason: RejectReason;
    note?: string;
  }) => void;
  pending: boolean;
}) {
  const [draft, update] = useDialogDraft<{
    reason: RejectReason | "";
    note: string;
  }>(target !== null, () => ({ reason: "", note: "" }));
  const { reason, note } = draft;

  return (
    <FormDialog
      open={target !== null}
      onClose={() => onOpenChange(false)}
      title={`Reject ${target?.name ?? ""}?`}
      description="Rejecting rules this mod out of this workshop. The entry stays visible with the reason, and you can re-review it later."
      onConfirm={() =>
        target &&
        reason !== "" &&
        onReject({
          workshopModId: target.workshopModId,
          reason,
          note: note.trim() || undefined,
        })
      }
      confirmLabel="Reject"
      disabled={!reason}
      loading={pending}
      destructive
      contentClassName="sm:max-w-lg"
    >
      <Field>
        <FieldLabel htmlFor="reject-mod-reason">Reason</FieldLabel>
        <Select
          value={reason}
          onValueChange={(value) => update({ reason: value as RejectReason })}
        >
          <SelectTrigger id="reject-mod-reason">
            <SelectValue placeholder="Pick a reason" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(WORKSHOP_MOD_REJECT_REASON_LABELS).map(
              ([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ),
            )}
          </SelectContent>
        </Select>
      </Field>
      <Field>
        <FieldLabel htmlFor="reject-note">Note (Optional)</FieldLabel>
        <Input
          id="reject-note"
          placeholder="Extra context, shown to players."
          maxLength={500}
          value={note}
          onChange={(event) => update({ note: event.target.value })}
        />
      </Field>
    </FormDialog>
  );
}
