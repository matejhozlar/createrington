import { ConfirmDialog } from "@/components/confirm-dialog";
import { useMutationToast } from "@/hooks/use-mutation-toast";
import { trpc, type RouterOutput } from "@/lib/trpc";

type FaqEntry = RouterOutput["admin"]["faq"]["list"]["entries"][number];

interface DeleteFaqModalProps {
  entry: FaqEntry | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function DeleteFaqModal({
  entry,
  onClose,
  onSuccess,
}: DeleteFaqModalProps) {
  const deleteEntry = trpc.admin.faq.delete.useMutation(
    useMutationToast({
      success: "FAQ entry deleted",
      error: "Failed to delete FAQ entry",
      onSuccess: () => {
        onSuccess();
      },
    }),
  );

  return (
    <ConfirmDialog
      open={entry !== null}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      title="Delete FAQ Entry"
      description={
        entry && (
          <>
            Are you sure you want to delete{" "}
            <span className="font-semibold">"{entry.title}"</span>? This action
            cannot be undone.
          </>
        )
      }
      confirmLabel="Delete"
      variant="destructive"
      onConfirm={() =>
        entry ? deleteEntry.mutateAsync({ id: entry.id }) : undefined
      }
    >
      {entry && (
        <div className="rounded-lg border border-border bg-muted/50 p-4">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Title:</span>
              <span className="font-medium">{entry.title}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pattern:</span>
              <span className="font-mono text-xs">{entry.pattern}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Priority:</span>
              <span className="font-medium">{entry.priority}</span>
            </div>
          </div>
        </div>
      )}
    </ConfirmDialog>
  );
}
