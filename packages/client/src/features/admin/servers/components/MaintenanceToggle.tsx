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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { useToastActions } from "@/hooks/use-toast";

interface MaintenanceToggleProps {
  serverId: number;
  isMaintenance: boolean;
}

export function MaintenanceToggle({
  serverId,
  isMaintenance,
}: MaintenanceToggleProps) {
  const toast = useToastActions();
  const [open, setOpen] = useState(false);
  const utils = trpc.useUtils();

  const toggleMutation = trpc.admin.servers.toggleMaintenance.useMutation({
    onSuccess: (data) => {
      toast.success(
        data.enabled
          ? "Maintenance mode enabled — whitelist cleared"
          : "Maintenance mode disabled — whitelist restored",
      );
      utils.admin.servers.get.invalidate({ id: serverId });
      utils.admin.servers.list.invalidate();
    },
    onError: (err: { message: string }) => {
      toast.error(err.message);
    },
    onSettled: () => {
      setOpen(false);
    },
  });

  function handleConfirm() {
    toggleMutation.mutate({ serverId, enabled: !isMaintenance });
  }

  return (
    <div
      className={cn(
        "mx-4 flex items-center justify-between rounded-lg border p-4",
        isMaintenance
          ? "border-amber-500/30 bg-amber-500/5"
          : "border-border bg-card",
      )}
    >
      <div className="flex items-center gap-3">
        <Wrench
          className={cn(
            "size-5",
            isMaintenance ? "text-amber-500" : "text-muted-foreground",
          )}
        />
        <div>
          <p className="text-sm font-medium">
            Maintenance Mode{" "}
            <span
              className={cn(
                "font-semibold",
                isMaintenance ? "text-amber-500" : "text-muted-foreground",
              )}
            >
              {isMaintenance ? "Active" : "Inactive"}
            </span>
          </p>
          <p className="text-xs text-muted-foreground">
            {isMaintenance
              ? "Whitelist is cleared — only ops can join"
              : "Toggle to clear the whitelist and restrict access to ops only"}
          </p>
        </div>
      </div>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger asChild>
          <Button
            variant={isMaintenance ? "default" : "outline"}
            size="sm"
            className={cn(
              "cursor-pointer",
              isMaintenance &&
                "bg-amber-500 text-white hover:bg-amber-600",
            )}
          >
            {isMaintenance ? "Disable" : "Enable"}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isMaintenance
                ? "Disable maintenance mode?"
                : "Enable maintenance mode?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isMaintenance
                ? "This will restore the whitelist file and reload it. All previously whitelisted players will be able to join again."
                : "This will clear the whitelist so only server operators can join. The current whitelist will be backed up and restored when maintenance ends."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              disabled={toggleMutation.isPending}
              className={cn(
                "cursor-pointer",
                !isMaintenance && "bg-amber-500 hover:bg-amber-600",
              )}
            >
              {toggleMutation.isPending
                ? "Processing..."
                : isMaintenance
                  ? "Disable"
                  : "Enable Maintenance"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
