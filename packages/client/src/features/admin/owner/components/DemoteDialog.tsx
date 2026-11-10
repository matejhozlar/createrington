import { useState } from "react";
import { FormDialog } from "@/components/form-dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, X } from "lucide-react";
import { trpc, queryClient } from "@/lib/trpc";
import { useToastActions } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Textarea } from "@/components/ui/textarea";

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

  const previewQuery = useQuery(
    trpc.owner.admins.previewDemote.queryOptions(
      { discordId: admin?.discordId ?? "" },
      { enabled: !!admin },
    ),
  );
  const demoteMutation = useMutation(
    trpc.owner.admins.demote.mutationOptions({
      onSuccess: () =>
        void queryClient.invalidateQueries(trpc.owner.admins.pathFilter()),
    }),
  );

  const preview = previewQuery.data;
  const displayName = admin?.minecraftUsername ?? admin?.discordId ?? "";

  const handleDemote = async () => {
    if (!admin) return;
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
    <FormDialog
      open={!!admin}
      onClose={handleClose}
      title={<>Demote {displayName}</>}
      description="This is a scorched-earth revoke — all admin state across every system is removed."
      confirmLabel="Demote"
      onConfirm={() => void handleDemote()}
      loading={demoteMutation.isPending}
      destructive
      contentClassName="sm:max-w-lg"
    >
      <div className="rounded-lg border bg-muted/50 p-4">
        {previewQuery.isLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex h-5 items-center gap-2">
                <Skeleton className="size-4 rounded" />
                <Skeleton className="h-3.5 w-44" />
              </div>
            ))}
          </div>
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
        <Textarea
          id="demote-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Stepped down, inactive, trust concerns"
          maxLength={500}
          rows={3}
        />
      </Field>
    </FormDialog>
  );
}
