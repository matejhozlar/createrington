import { useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { ListChecks, RefreshCw } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useToastActions } from "@/hooks/use-toast";

interface WhitelistResyncProps {
  serverId: number;
}

export function WhitelistResync({ serverId }: WhitelistResyncProps) {
  const toast = useToastActions();
  const [dialogOpen, setDialogOpen] = useState(false);
  const utils = trpc.useUtils();

  const resyncMutation = trpc.admin.servers.resyncWhitelist.useMutation({
    onSuccess: ({ count }) => {
      toast.success(`Whitelist resynced (${count} players)`);
      utils.admin.servers.get.invalidate({ id: serverId });
      utils.admin.servers.list.invalidate();
    },
    onError: (err: { message: string }) => toast.error(err.message),
  });

  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <ListChecks className="size-5 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">Whitelist Resync</p>
          <p className="text-xs text-muted-foreground">
            Rebuild whitelist.json from the registered players and reload it
          </p>
        </div>
      </div>

      <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
        <RefreshCw className="mr-1.5 size-3.5" />
        Resync
      </Button>

      <ConfirmDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="Resync whitelist?"
        description="This deletes the server's current whitelist.json, regenerates it from every registered player without an active ban, and reloads it. Players removed from the whitelist will be unable to rejoin until re-added."
        confirmLabel="Resync"
        onConfirm={() => resyncMutation.mutateAsync({ serverId })}
      />
    </div>
  );
}
