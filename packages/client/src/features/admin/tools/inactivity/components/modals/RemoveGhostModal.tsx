import { useState } from "react";
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
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useToastActions } from "@/hooks/use-toast";
import { trpc, type RouterOutput } from "@/lib/trpc";

type Ghost =
  RouterOutput["admin"]["inactivity"]["ghosts"]["list"]["items"][number];

interface RemoveGhostModalProps {
  open: boolean;
  onClose: () => void;
  ghost: Ghost;
  canMutate: boolean;
  onSuccess: () => void;
}

const CONFIRM_TOKEN = "REMOVE";

export function RemoveGhostModal({
  open,
  onClose,
  ghost,
  canMutate,
  onSuccess,
}: RemoveGhostModalProps) {
  const toast = useToastActions();
  const [confirmText, setConfirmText] = useState("");

  const verifyQuery = trpc.admin.inactivity.ghosts.verify.useQuery(
    { discordId: ghost.discordId },
    {
      enabled: open,
      // Always re-verify when the dialog opens, even if cached.
      refetchOnMount: "always",
      staleTime: 0,
      gcTime: 0,
    },
  );

  const removeGhost = trpc.admin.inactivity.ghosts.remove.useMutation();

  const stillGone = verifyQuery.data?.stillGone === true;
  const rejoined = verifyQuery.data?.stillGone === false;

  const canConfirm =
    canMutate &&
    stillGone &&
    confirmText === CONFIRM_TOKEN &&
    !verifyQuery.isFetching;

  const handleClose = () => {
    setConfirmText("");
    onClose();
  };

  const handleRemove = async () => {
    try {
      await removeGhost.mutateAsync({ discordId: ghost.discordId });
      toast.success("Ghost member removed");
      setConfirmText("");
      onSuccess();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to remove ghost",
      );
    }
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(isOpen) => !isOpen && handleClose()}
    >
      <AlertDialogContent className="border-destructive">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-destructive">
            Remove Ghost Player
          </AlertDialogTitle>
          <AlertDialogDescription>
            This will remove{" "}
            <span className="font-semibold">
              &quot;{ghost.minecraftUsername}&quot;
            </span>{" "}
            from all Minecraft server whitelists and delete their player record.
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Verification banner */}
        {verifyQuery.isFetching ? (
          <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 p-3 text-sm">
            <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
            <span className="text-muted-foreground">
              Checking Discord membership...
            </span>
          </div>
        ) : verifyQuery.isError ? (
          <div className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            <XCircle className="size-4 shrink-0 text-amber-500 mt-0.5" />
            <div>
              <p className="font-medium text-amber-200">
                Could not verify Discord membership
              </p>
              <p className="text-amber-300/80">
                {verifyQuery.error?.message ?? "Unknown error"}. Removal blocked
                until the check succeeds.
              </p>
            </div>
          </div>
        ) : stillGone ? (
          <div className="flex items-start gap-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm">
            <CheckCircle2 className="size-4 shrink-0 text-emerald-500 mt-0.5" />
            <div>
              <p className="font-medium text-emerald-200">
                User is still missing from Discord
              </p>
              <p className="text-emerald-300/80">
                Verification just confirmed this user is not in the guild.
                Removal allowed.
              </p>
            </div>
          </div>
        ) : rejoined ? (
          <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
            <XCircle className="size-4 shrink-0 text-destructive mt-0.5" />
            <div>
              <p className="font-medium text-destructive">
                User has rejoined Discord
              </p>
              <p className="text-destructive/80">
                This user is back in the guild and was just removed from the
                ghost cache. Close this dialog and refresh the list.
              </p>
            </div>
          </div>
        ) : null}

        <div className="rounded-lg border border-border bg-muted/50 p-4">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Username:</span>
              <span className="font-medium">{ghost.minecraftUsername}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Discord ID:</span>
              <span className="font-mono text-xs">{ghost.discordId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Last seen:</span>
              <span className="font-medium">
                {new Date(ghost.playerLastSeen).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>

        <Field>
          <FieldLabel htmlFor="remove-ghost-confirm">
            Type{" "}
            <span className="font-mono font-semibold">{CONFIRM_TOKEN}</span> to
            confirm
          </FieldLabel>
          <Input
            id="remove-ghost-confirm"
            type="text"
            placeholder={CONFIRM_TOKEN}
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            disabled={!stillGone || verifyQuery.isFetching}
            autoFocus
          />
        </Field>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleClose}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={handleRemove}
            disabled={!canConfirm || removeGhost.isPending}
          >
            {removeGhost.isPending ? "Removing..." : "Remove Ghost"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
