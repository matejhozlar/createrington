import { ConfirmDialog } from "@/components/confirm-dialog";
import { useToastActions } from "@/hooks/use-toast";
import { useMutationToast } from "@/hooks/use-mutation-toast";
import { trpc, queryClient, type RouterOutput } from "@/lib/trpc";
import { useMutation } from "@tanstack/react-query";

type WaitlistEntry =
  RouterOutput["admin"]["waitlists"]["list"]["items"][number];

interface PromoteWaitlistModalProps {
  open: boolean;
  onClose: () => void;
  entry: WaitlistEntry;
}

export function PromoteWaitlistModal({
  open,
  onClose,
  entry,
}: PromoteWaitlistModalProps) {
  const toast = useToastActions();
  const promoteEntry = useMutation(
    trpc.admin.waitlists.promote.mutationOptions(
      useMutationToast({
        onSuccess: (result) => {
          void queryClient.invalidateQueries(trpc.admin.waitlists.pathFilter());
          if (result.notified) {
            toast.success("Waitlist entry promoted");
          } else {
            toast.warning(
              "Spot reserved, but the member couldn't be pinged in Discord. They'll see the Register button when they refresh their card.",
            );
          }
        },
      }),
    ),
  );

  const handleSubmit = () => promoteEntry.mutateAsync({ id: entry.id });

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      title="Promote Waitlist Entry"
      description={
        <>
          This will reserve a spot for{" "}
          <span className="font-semibold">{entry.discordUsername}</span> and
          ping them in their verification channel so they can register
          immediately. If they don't register within 7 days, the spot passes to
          the next person in line.
        </>
      }
      confirmLabel="Promote"
      onConfirm={handleSubmit}
    />
  );
}
