import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToastActions } from "@/hooks/use-toast";
import { trpc, type RouterOutput } from "@/lib/trpc";

type WaitlistEntry =
  RouterOutput["admin"]["waitlists"]["list"]["entries"][number];

interface PromoteWaitlistModalProps {
  open: boolean;
  onClose: () => void;
  entry: WaitlistEntry;
  onSuccess: () => void;
}

export function PromoteWaitlistModal({
  open,
  onClose,
  entry,
  onSuccess,
}: PromoteWaitlistModalProps) {
  const toast = useToastActions();
  const promoteEntry = trpc.admin.waitlists.promote.useMutation();

  const handleSubmit = async () => {
    try {
      await promoteEntry.mutateAsync({ id: entry.id });

      toast.success("Waitlist entry promoted");
      onClose();
      onSuccess();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to promote waitlist entry",
      );
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Promote Waitlist Entry</DialogTitle>
          <DialogDescription>
            This will reserve a spot for{" "}
            <span className="font-semibold">{entry.discordUsername}</span> and
            ping them in their verification channel so they can register
            immediately. If they don't register within 7 days, the spot passes
            to the next person in line.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button
            variant="outline"
            className="flex-1 cursor-pointer"
            onClick={onClose}
            disabled={promoteEntry.isPending}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 cursor-pointer"
            onClick={handleSubmit}
            loading={promoteEntry.isPending}
          >
            Promote
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
