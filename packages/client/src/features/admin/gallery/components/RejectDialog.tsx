import { ConfirmDialog } from "@/components/confirm-dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { useDialogDraft } from "@/hooks/use-dialog-draft";

const MAX_NOTE_LENGTH = 500;

interface RejectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  authorName: string;
  onConfirm: (note: string) => Promise<unknown>;
}

export function RejectDialog({
  open,
  onOpenChange,
  authorName,
  onConfirm,
}: RejectDialogProps) {
  const [{ note }, update] = useDialogDraft(open, { note: "" });

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Reject this screenshot?"
      description={`The submission by ${authorName} will be marked rejected and the stored image deleted. The player is not notified.`}
      confirmLabel="Reject"
      variant="destructive"
      onConfirm={() => onConfirm(note)}
    >
      <Field>
        <FieldLabel htmlFor="gallery-reject-note">Note</FieldLabel>
        <Textarea
          id="gallery-reject-note"
          value={note}
          maxLength={MAX_NOTE_LENGTH}
          rows={3}
          placeholder="Optional reason for the audit log"
          onChange={(e) => update({ note: e.target.value })}
        />
        <FieldDescription>Only visible to admins.</FieldDescription>
      </Field>
    </ConfirmDialog>
  );
}
