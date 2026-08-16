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
import { trpc } from "@/lib/trpc";

interface DeletePromptModalProps {
  open: boolean;
  onClose: () => void;
  prompt: {
    id: number;
    question: string;
    status: "active" | "closed";
  };
  /** Total entries recorded against the prompt, all of which are destroyed. */
  entryCount: number;
  onSuccess: () => void;
}

export function DeletePromptModal({
  open,
  onClose,
  prompt,
  entryCount,
  onSuccess,
}: DeletePromptModalProps) {
  const toast = useToastActions();
  const deletePrompt = trpc.admin.prompts.delete.useMutation();

  const handleDelete = async () => {
    try {
      await deletePrompt.mutateAsync({ id: prompt.id });
      toast.success("Prompt deleted");
      onSuccess();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete prompt",
      );
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Prompt</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete{" "}
            <span className="font-semibold">"{prompt.question}"</span>? Its
            Discord announcement is removed too. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="rounded-lg border border-border bg-muted/50 p-4">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status:</span>
              <span className="font-medium">
                {prompt.status === "active" ? "Active" : "Closed"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Entries deleted:</span>
              <span className="font-medium">{entryCount}</span>
            </div>
          </div>
          {prompt.status === "active" && (
            <p className="mt-3 text-xs text-muted-foreground">
              This prompt is still accepting responses. Close it instead if you
              only want to stop new entries.
            </p>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={handleDelete}
            disabled={deletePrompt.isPending}
          >
            {deletePrompt.isPending ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
