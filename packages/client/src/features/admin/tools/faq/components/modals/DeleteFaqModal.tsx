import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToastActions } from "@/hooks/use-toast";
import { trpc, type RouterOutput } from "@/lib/trpc";

type FaqEntry = RouterOutput["admin"]["faq"]["list"]["entries"][number];

interface DeleteFaqModalProps {
  open: boolean;
  onClose: () => void;
  entry: FaqEntry;
  onSuccess: () => void;
}

export function DeleteFaqModal({
  open,
  onClose,
  entry,
  onSuccess,
}: DeleteFaqModalProps) {
  const toast = useToastActions();
  const deleteEntry = trpc.admin.faq.delete.useMutation();

  const handleDelete = async () => {
    try {
      await deleteEntry.mutateAsync({ id: entry.id });
      toast.success("FAQ entry deleted");
      onSuccess();
    } catch {
      toast.error("Failed to delete FAQ entry");
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete FAQ Entry</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete{" "}
            <span className="font-semibold">"{entry.title}"</span>? This action
            cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

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

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteEntry.isPending}
          >
            {deleteEntry.isPending ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
