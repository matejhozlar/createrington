import { useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";

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
  const [note, setNote] = useState("");

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
        <textarea
          id="gallery-reject-note"
          value={note}
          maxLength={MAX_NOTE_LENGTH}
          rows={3}
          placeholder="Optional reason for the audit log"
          onChange={(e) => setNote(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <FieldDescription>Only visible to admins.</FieldDescription>
      </Field>
    </ConfirmDialog>
  );
}
