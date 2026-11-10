import { useState } from "react";
import { FormDialog } from "@/components/form-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { REJECT_REASON_LABELS } from "@/features/workshop/format";
import { WORKSHOP_MOD_REJECT_REASONS } from "@createrington/shared/workshop";

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
  const [reason, setReason] = useState<RejectReason | "">("");
  const [note, setNote] = useState("");

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
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Reason</Label>
          <Select
            value={reason}
            onValueChange={(value) => setReason(value as RejectReason)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Pick a reason" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(REJECT_REASON_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="reject-note">Note (Optional)</Label>
          <Input
            id="reject-note"
            placeholder="Extra context, shown to players."
            maxLength={500}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </div>
      </div>
    </FormDialog>
  );
}
