import { useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { ListChecks, RefreshCw } from "lucide-react";
import { trpc, queryClient } from "@/lib/trpc";
import { useMutationToast } from "@/hooks/use-mutation-toast";
import { useMutation } from "@tanstack/react-query";

interface WhitelistResyncProps {
  serverId: number;
}

export function WhitelistResync({ serverId }: WhitelistResyncProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const resyncMutation = useMutation(
    trpc.admin.servers.resyncWhitelist.mutationOptions(
      useMutationToast({
        success: ({ count }) => `Whitelist resynced (${count} players)`,
        onSuccess: () => {
          void queryClient.invalidateQueries(
            trpc.admin.servers.get.queryFilter({ id: serverId }),
          );
          void queryClient.invalidateQueries(
            trpc.admin.servers.list.pathFilter(),
          );
        },
      }),
    ),
  );

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
