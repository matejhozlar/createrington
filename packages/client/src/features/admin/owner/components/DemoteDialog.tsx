import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Check, X } from "lucide-react";
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

  const handleClose = () => {
    setReason("");
    onClose();
  };

  return (
    <Dialog
      open={!!admin}
      onOpenChange={(isOpen) => {
        if (!isOpen) handleClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Demote {displayName}</DialogTitle>
          <DialogDescription>
            This is a scorched-earth revoke — all admin state across every
            system is removed.
          </DialogDescription>
        </DialogHeader>

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

        <Field>
          <FieldLabel htmlFor="demote-reason">Reason (optional)</FieldLabel>
          <textarea
            id="demote-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Stepped down, inactive, trust concerns"
            maxLength={500}
            rows={3}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </Field>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => void handleDemote()}
            disabled={demoteMutation.isPending}
          >
            {demoteMutation.isPending ? "Demoting…" : "Demote"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
