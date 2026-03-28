import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToastActions } from "@/hooks/use-toast";
import { trpc } from "@/lib/trpc";

interface RemoveStrikeModalProps {
  open: boolean;
  onClose: () => void;
  playerId: string; // minecraftUuid
  strikeId: number;
  onSuccess: () => void; // call onRefresh from parent
}

export function RemoveStrikeModal({
  open,
  onClose,
  playerId,
  strikeId,
  onSuccess,
}: RemoveStrikeModalProps) {
  const toast = useToastActions();
  const removeStrike = trpc.admin.players.strikes.remove.useMutation();

  const [reason, setReason] = useState("");

  const handleSubmit = async () => {
    if (!reason.trim()) return;

    try {
      await removeStrike.mutateAsync({
        id: playerId,
        strikeId,
        reason: reason.trim(),
      });

      toast.success("Strike removed");
      setReason("");
      onClose();
      onSuccess();
    } catch {
      toast.error("Failed to remove strike");
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Remove Strike</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Field>
            <FieldLabel htmlFor="remove-strike-reason">Reason</FieldLabel>
            <textarea
              id="remove-strike-reason"
              placeholder="Explain why this strike is being removed..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              rows={4}
            />
          </Field>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            className="flex-1 cursor-pointer"
            onClick={onClose}
            disabled={removeStrike.isPending}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 cursor-pointer"
            onClick={handleSubmit}
            disabled={!reason.trim() || removeStrike.isPending}
          >
            {removeStrike.isPending ? "Removing..." : "Remove Strike"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
