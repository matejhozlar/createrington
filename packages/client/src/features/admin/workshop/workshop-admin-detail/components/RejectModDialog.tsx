import { useState } from "react";
import { useStickyValue } from "@/hooks/use-sticky-value";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  // Held so the mod's name survives the close animation, since the parent
  // clears the target the moment the reject succeeds
  const displayTarget = useStickyValue(target);

  return (
    <Dialog open={target !== null} onOpenChange={onOpenChange}>
      <DialogContent onOpenAutoFocus={(event) => event.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Reject {displayTarget?.name}?</DialogTitle>
          <DialogDescription>
            Rejecting rules this mod out of this workshop. The entry stays
            visible with the reason, and you can re-review it later.
          </DialogDescription>
        </DialogHeader>
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
        <DialogFooter>
          <Button
            variant="destructive"
            disabled={!reason}
            loading={pending}
            onClick={() =>
              displayTarget &&
              reason !== "" &&
              onReject({
                workshopModId: displayTarget.workshopModId,
                reason,
                note: note.trim() || undefined,
              })
            }
          >
            Reject
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
