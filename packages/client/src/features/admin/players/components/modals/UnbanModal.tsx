import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { useToastActions } from "@/hooks/use-toast";

interface UnbanModalProps {
  open: boolean;
  onClose: () => void;
  banId: number;
  onSuccess: () => void;
}

export function UnbanModal({
  open,
  onClose,
  banId,
  onSuccess,
}: UnbanModalProps) {
  const toast = useToastActions();
  const unbanPlayer = trpc.admin.players.bans.unban.useMutation();

  const [reason, setReason] = useState("");

  const handleSubmit = async () => {
    if (!reason.trim()) {
      toast.error("Reason is required");
      return;
    }

    try {
      await unbanPlayer.mutateAsync({
        banId,
        reason: reason.trim(),
      });

      toast.success("Ban lifted");

      // Reset form
      setReason("");
      onSuccess();
      onClose();
    } catch {
      toast.error("Failed to unban player");
    }
  };

  const handleClose = () => {
    setReason("");
    onClose();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) handleClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Unban Player</DialogTitle>
          <DialogDescription>
            This will lift the ban and allow the player to rejoin the server.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/50 p-3">
            <p className="text-sm">
              <span className="text-muted-foreground">Ban ID:</span>{" "}
              <span className="font-mono font-medium">#{banId}</span>
            </p>
          </div>

          <Field>
            <FieldLabel htmlFor="unban-reason">Reason for Unbanning</FieldLabel>
            <textarea
              id="unban-reason"
              placeholder="Enter reason for lifting the ban..."
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
            onClick={handleClose}
            disabled={unbanPlayer.isPending}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 cursor-pointer"
            onClick={handleSubmit}
            disabled={!reason.trim() || unbanPlayer.isPending}
          >
            {unbanPlayer.isPending ? "Unbanning..." : "Unban Player"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
