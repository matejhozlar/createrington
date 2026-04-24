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
import { Label } from "@/components/ui/label";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { useToastActions } from "@/hooks/use-toast";

interface DemoteDialogProps {
  admin: {
    discordId: string;
    minecraftUsername: string | null;
  } | null;
  onClose: () => void;
  onSuccess: (result: {
    minecraftUsername: string | null;
    removedFromDb: boolean;
    discordRoleRemoved: boolean;
    rconResults: Array<{ serverId: number; success: boolean; error?: string }>;
  }) => void;
}

export function DemoteDialog({ admin, onClose, onSuccess }: DemoteDialogProps) {
  const toast = useToastActions();
  const [reason, setReason] = useState("");

  const previewQuery = trpc.owner.admins.previewDemote.useQuery(
    { discordId: admin?.discordId ?? "" },
    { enabled: !!admin },
  );
  const demoteMutation = trpc.owner.admins.demote.useMutation();

  if (!admin) return null;

  const preview = previewQuery.data;
  const displayName = admin.minecraftUsername ?? admin.discordId;

  const handleDemote = async () => {
    try {
      const result = await demoteMutation.mutateAsync({
        discordId: admin.discordId,
        reason: reason.trim() || undefined,
      });
      onSuccess(result);
      setReason("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to demote");
    }
  };

  const actionRow = (label: string, enabled: boolean, detail?: string) => (
    <div className="flex items-center justify-between gap-2 text-sm">
      <div className="flex items-center gap-2">
        {enabled ? (
          <Check className="size-4 text-destructive" />
        ) : (
          <X className="size-4 text-muted-foreground" />
        )}
        <span className={enabled ? "" : "text-muted-foreground line-through"}>
          {label}
        </span>
      </div>
      {detail && (
        <span className="text-xs text-muted-foreground">{detail}</span>
      )}
    </div>
  );

  return (
    <AlertDialog
      open={!!admin}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          setReason("");
          onClose();
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Demote {displayName}</AlertDialogTitle>
          <AlertDialogDescription>
            This is a scorched-earth revoke — all admin state across every
            system is removed.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="rounded-lg border bg-muted/50 p-4">
          {previewQuery.isLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : preview ? (
            <div className="flex flex-col gap-2">
              {actionRow("Remove DB admin entry", preview.inDb)}
              {actionRow("Remove Discord ADMIN role", preview.hasDiscordRole)}
              {actionRow(
                "Run /deop on Minecraft servers",
                preview.serverCount > 0 && !!preview.minecraftUsername,
                `${preview.serverCount} server${preview.serverCount !== 1 ? "s" : ""}`,
              )}
              {actionRow(
                "Revoke active web sessions",
                preview.activeSessions > 0,
                `${preview.activeSessions} session${preview.activeSessions !== 1 ? "s" : ""}`,
              )}
            </div>
          ) : (
            <div className="text-sm text-destructive">
              Failed to load preview.
            </div>
          )}
        </div>

        <div>
          <Label htmlFor="demote-reason">Reason (optional)</Label>
          <textarea
            id="demote-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Stepped down, inactive, trust concerns"
            maxLength={500}
            rows={3}
            className={cn(
              "mt-1 flex w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            )}
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setReason("")}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              // AlertDialogAction closes the dialog synchronously on click,
              // which would hide any error toast + force the owner to
              // re-open on failure. Suppress that; onSuccess closes the
              // dialog itself on the happy path.
              e.preventDefault();
              void handleDemote();
            }}
            disabled={demoteMutation.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {demoteMutation.isPending ? "Demoting…" : "Demote"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
