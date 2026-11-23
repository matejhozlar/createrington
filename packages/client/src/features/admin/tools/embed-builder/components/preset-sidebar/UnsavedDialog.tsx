import { ConfirmDialog } from "@/components/confirm-dialog";

export function UnsavedDialog({
  pendingAction,
  setPendingAction,
}: {
  pendingAction: (() => void) | null;
  setPendingAction: (next: (() => void) | null) => void;
}) {
  return (
    <ConfirmDialog
      open={!!pendingAction}
      onOpenChange={(open) => {
        if (!open) setPendingAction(null);
      }}
      size="sm"
      variant="destructive"
      title="Unsaved changes"
      description="You have unsaved changes that will be lost. Continue?"
      confirmLabel="Discard changes"
      onConfirm={() => pendingAction?.()}
    />
  );
}
