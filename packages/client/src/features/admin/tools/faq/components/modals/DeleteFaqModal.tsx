import { ConfirmDialog } from "@/components/confirm-dialog";
import { useStickyValue } from "@/hooks/use-sticky-value";
import { useToastActions } from "@/hooks/use-toast";
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
  const toast = useToastActions();
  const deleteEntry = trpc.admin.faq.delete.useMutation({
    onSuccess: () => {
      toast.success("FAQ entry deleted");
      onSuccess();
    },
    onError: () => toast.error("Failed to delete FAQ entry"),
  });
  const displayEntry = useStickyValue(entry);

  return (
    <ConfirmDialog
      open={entry !== null}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      title="Delete FAQ Entry"
      description={
        displayEntry && (
          <>
            Are you sure you want to delete{" "}
            <span className="font-semibold">"{displayEntry.title}"</span>? This
            action cannot be undone.
          </>
        )
      }
      confirmLabel="Delete"
      variant="destructive"
      onConfirm={() =>
        entry ? deleteEntry.mutateAsync({ id: entry.id }) : undefined
      }
    >
      {displayEntry && (
        <div className="rounded-lg border border-border bg-muted/50 p-4">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Title:</span>
              <span className="font-medium">{displayEntry.title}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pattern:</span>
              <span className="font-mono text-xs">{displayEntry.pattern}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Priority:</span>
              <span className="font-medium">{displayEntry.priority}</span>
            </div>
          </div>
        </div>
      )}
    </ConfirmDialog>
  );
}
