import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { X } from "lucide-react";
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

  if (!open) return null;

  const handleSubmit = async () => {
    if (!reason.trim()) return;

    try {
      await removeStrike.mutateAsync({
        id: playerId,
        strikeId,
        reason: reason.trim(),
      });

      toast.success("Strike removed successfully!");
      setReason("");
      onClose();
      onSuccess();
    } catch (err) {
      console.error("Failed to remove strike:", err);
      toast.error("Failed to remove strike");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Remove Strike</h3>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="cursor-pointer"
          >
            <X className="size-4" />
          </Button>
        </div>

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

          <div className="flex gap-2">
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
          </div>
        </div>
      </div>
    </div>
  );
}
