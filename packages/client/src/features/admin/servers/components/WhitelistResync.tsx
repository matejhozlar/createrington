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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { ListChecks, RefreshCw } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useToastActions } from "@/hooks/use-toast";

interface WhitelistResyncProps {
  serverId: number;
  isMaintenance: boolean;
}

export function WhitelistResync({
  serverId,
  isMaintenance,
}: WhitelistResyncProps) {
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
    onSettled: () => setDialogOpen(false),
  });

  const disabled = isMaintenance || resyncMutation.isPending;

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

      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span tabIndex={isMaintenance ? 0 : undefined}>
              <Button
                variant="outline"
                size="sm"
                disabled={disabled}
                onClick={() => setDialogOpen(true)}
              >
                <RefreshCw className="mr-1.5 size-3.5" />
                Resync
              </Button>
            </span>
          </TooltipTrigger>
          {isMaintenance && (
            <TooltipContent>Unavailable during maintenance</TooltipContent>
          )}
        </Tooltip>

        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resync whitelist?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes the server&apos;s current whitelist.json, regenerates
              it from every registered player without an active ban, and reloads
              it. Players removed from the whitelist will be unable to rejoin
              until re-added.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                resyncMutation.mutate({ serverId });
              }}
              disabled={resyncMutation.isPending}
            >
              {resyncMutation.isPending ? "Resyncing..." : "Resync"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
