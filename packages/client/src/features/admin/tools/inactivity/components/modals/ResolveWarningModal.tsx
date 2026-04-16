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

type Warning = RouterOutput["admin"]["inactivity"]["list"]["warnings"][number];

interface ResolveWarningModalProps {
  open: boolean;
  onClose: () => void;
  warning: Warning;
  onSuccess: () => void;
}

export function ResolveWarningModal({
  open,
  onClose,
  warning,
  onSuccess,
}: ResolveWarningModalProps) {
  const toast = useToastActions();
  const resolveWarning = trpc.admin.inactivity.resolveManual.useMutation();

  const displayName =
    warning.minecraftUsername ?? `UUID ${warning.playerMinecraftUuid}`;

  const handleResolve = async () => {
    try {
      await resolveWarning.mutateAsync({ id: warning.id });
      toast.success("Warning resolved");
      onSuccess();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to resolve warning",
      );
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Resolve Inactivity Warning</AlertDialogTitle>
          <AlertDialogDescription>
            Mark{" "}
            <span className="font-semibold">&quot;{displayName}&quot;</span> as
            returned? The warning will be closed and they will not be removed by
            the next cleanup cycle.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="rounded-lg border border-border bg-muted/50 p-4">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Username:</span>
              <span className="font-medium">{displayName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Warned:</span>
              <span className="font-medium">
                {new Date(warning.warnedAt).toLocaleDateString()}
              </span>
            </div>
            {warning.lastSeen && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last seen:</span>
                <span className="font-medium">
                  {new Date(warning.lastSeen).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleResolve}
            disabled={resolveWarning.isPending}
          >
            {resolveWarning.isPending ? "Resolving..." : "Resolve"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
