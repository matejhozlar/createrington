import { ConfirmDialog } from "@/components/confirm-dialog";
import { useStickyValue } from "@/hooks/use-sticky-value";
import { useToastActions } from "@/hooks/use-toast";
import { trpc } from "@/lib/trpc";

interface DeletePromptModalProps {
  prompt: {
    id: number;
    question: string;
    status: "active" | "closed";
  } | null;
  entryCount: number;
  onClose: () => void;
  onSuccess: () => void;
}

export function DeletePromptModal({
  prompt,
  entryCount,
  onClose,
  onSuccess,
}: DeletePromptModalProps) {
  const toast = useToastActions();
  const utils = trpc.useUtils();
  const deletePrompt = trpc.admin.prompts.delete.useMutation({
    onSuccess: async (_data, variables) => {
      await utils.admin.prompts.list.invalidate();
      void utils.admin.prompts.get.reset({ id: variables.id });
      toast.success("Prompt deleted");
      onSuccess();
    },
    onError: (error) => toast.error(error.message || "Failed to delete prompt"),
  });
  const displayPrompt = useStickyValue(prompt);
  const displayCount = useStickyValue(prompt !== null ? entryCount : null);

  return (
    <ConfirmDialog
      open={prompt !== null}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      title="Delete Prompt"
      description={
        displayPrompt && (
          <>
            Are you sure you want to delete{" "}
            <span className="font-semibold">"{displayPrompt.question}"</span>?
            Its Discord announcement is removed too. This action cannot be
            undone.
          </>
        )
      }
      confirmLabel="Delete"
      variant="destructive"
      onConfirm={() =>
        prompt ? deletePrompt.mutateAsync({ id: prompt.id }) : undefined
      }
    >
      {displayPrompt && (
        <div className="rounded-lg border border-border bg-muted/50 p-4">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status:</span>
              <span className="font-medium">
                {displayPrompt.status === "active" ? "Active" : "Closed"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Entries deleted:</span>
              <span className="font-medium">{displayCount ?? 0}</span>
            </div>
          </div>
          {displayPrompt.status === "active" && (
            <p className="mt-3 text-xs text-muted-foreground">
              This prompt is still accepting responses. Close it instead if you
              only want to stop new entries.
            </p>
          )}
        </div>
      )}
    </ConfirmDialog>
  );
}
