import { useMemo, useState } from "react";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarClock, Clock, Wrench, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { useToastActions } from "@/hooks/use-toast";
import { useCountdown } from "@/hooks/use-countdown";

interface MaintenanceToggleProps {
  serverId: number;
  isMaintenance: boolean;
}

/**
 * Admin control for a server's maintenance mode.
 *
 * Renders one of three states based on current maintenance status:
 * - State A: Inactive — offers instant enable or scheduled enable via a dialog
 * - State B: Scheduled — shows countdown and a cancel confirmation
 * - State C: Active — shows active indicator and a disable confirmation
 *
 * @param serverId - ID of the server to manage
 * @param isMaintenance - Whether maintenance mode is currently active on the server
 */
export function MaintenanceToggle({
  serverId,
  isMaintenance,
}: MaintenanceToggleProps) {
  const toast = useToastActions();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [disableDialogOpen, setDisableDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [announceEnd, setAnnounceEnd] = useState(true);
  const [scheduledAt, setScheduledAt] = useState("");
  const [estimatedMinutes, setEstimatedMinutes] = useState(30);
  const utils = trpc.useUtils();

  // Compute min datetime for the input (1 minute from now, recalculated when dialog opens)
  const minDatetime = useMemo(
    () => new Date(Date.now() + 60000).toISOString().slice(0, 16),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dialogOpen],
  );

  const { data: status } = trpc.admin.servers.maintenanceStatus.useQuery({
    serverId,
  });

  const schedule = status?.schedule ?? null;
  const countdown = useCountdown(schedule?.scheduledAt ?? null);

  const invalidate = () => {
    utils.admin.servers.get.invalidate({ id: serverId });
    utils.admin.servers.list.invalidate();
    utils.admin.servers.maintenanceStatus.invalidate({ serverId });
  };

  const toggleMutation = trpc.admin.servers.toggleMaintenance.useMutation({
    onSuccess: (data) => {
      toast.success(
        data.enabled
          ? "Maintenance mode enabled — whitelist cleared"
          : "Maintenance mode disabled — whitelist restored",
      );
      invalidate();
    },
    onError: (err: { message: string }) => toast.error(err.message),
    onSettled: () => {
      setDialogOpen(false);
      setDisableDialogOpen(false);
    },
  });

  const scheduleMutation = trpc.admin.servers.scheduleMaintenance.useMutation({
    onSuccess: () => {
      toast.success("Maintenance scheduled");
      invalidate();
      setDialogOpen(false);
      setScheduledAt("");
      setEstimatedMinutes(30);
    },
    onError: (err: { message: string }) => toast.error(err.message),
  });

  const cancelMutation =
    trpc.admin.servers.cancelScheduledMaintenance.useMutation({
      onSuccess: () => {
        toast.success("Scheduled maintenance cancelled");
        invalidate();
        setCancelDialogOpen(false);
      },
      onError: (err: { message: string }) => toast.error(err.message),
    });

  function handleInstantEnable() {
    toggleMutation.mutate({ serverId, enabled: true });
  }

  function handleDisable() {
    toggleMutation.mutate({ serverId, enabled: false, announce: announceEnd });
  }

  function handleSchedule() {
    if (!scheduledAt) return;
    const date = new Date(scheduledAt);
    scheduleMutation.mutate({
      serverId,
      scheduledAt: date.toISOString(),
      estimatedMinutes,
    });
  }

  function handleCancelSchedule() {
    cancelMutation.mutate({ serverId });
  }

  // State B: Scheduled (not yet active)
  if (schedule?.status === "scheduled") {
    return (
      <div className="mx-4 flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
        <div className="flex items-center gap-3">
          <CalendarClock className="size-5 text-amber-500" />
          <div>
            <p className="text-sm font-medium">
              Maintenance Scheduled{" "}
              {countdown && (
                <span className="font-mono text-amber-500">{countdown}</span>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              Starts{" "}
              {new Date(schedule.scheduledAt).toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })}{" "}
              · ~{schedule.estimatedMinutes} min
            </p>
          </div>
        </div>

        <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer"
            onClick={() => setCancelDialogOpen(true)}
          >
            <X className="mr-1 size-3.5" />
            Cancel
          </Button>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel scheduled maintenance?</AlertDialogTitle>
              <AlertDialogDescription>
                The scheduled maintenance and all pending Discord warnings will
                be cancelled.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="cursor-pointer">
                Keep Schedule
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleCancelSchedule}
                disabled={cancelMutation.isPending}
                className="cursor-pointer bg-destructive hover:bg-destructive/90"
              >
                {cancelMutation.isPending ? "Cancelling..." : "Cancel Schedule"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // State C: Active maintenance
  if (isMaintenance) {
    return (
      <div className="mx-4 flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
        <div className="flex items-center gap-3">
          <Wrench className="size-5 text-amber-500" />
          <div>
            <p className="text-sm font-medium">
              Maintenance Mode{" "}
              <span className="font-semibold text-amber-500">Active</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Whitelist is cleared — only ops can join
            </p>
          </div>
        </div>

        <AlertDialog
          open={disableDialogOpen}
          onOpenChange={setDisableDialogOpen}
        >
          <Button
            variant="default"
            size="sm"
            className="cursor-pointer bg-amber-500 text-white hover:bg-amber-600"
            onClick={() => setDisableDialogOpen(true)}
          >
            Disable
          </Button>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Disable maintenance mode?</AlertDialogTitle>
              <AlertDialogDescription>
                This will restore the whitelist file and reload it. All
                previously whitelisted players will be able to join again.
              </AlertDialogDescription>
              <div className="mt-3 flex items-center gap-2">
                <Checkbox
                  id="announce-end"
                  checked={announceEnd}
                  onCheckedChange={(checked) =>
                    setAnnounceEnd(checked === true)
                  }
                />
                <Label
                  htmlFor="announce-end"
                  className="text-sm cursor-pointer"
                >
                  Send &quot;maintenance ended&quot; announcement to Discord
                </Label>
              </div>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="cursor-pointer">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDisable}
                disabled={toggleMutation.isPending}
                className="cursor-pointer"
              >
                {toggleMutation.isPending ? "Processing..." : "Disable"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // State A: No maintenance, no schedule
  return (
    <div className="mx-4 flex items-center justify-between rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <Wrench className="size-5 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">
            Maintenance Mode{" "}
            <span className="font-semibold text-muted-foreground">
              Inactive
            </span>
          </p>
          <p className="text-xs text-muted-foreground">
            Toggle to clear the whitelist and restrict access to ops only
          </p>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="cursor-pointer">
            Enable
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enable maintenance mode</DialogTitle>
            <DialogDescription>
              Choose to start maintenance immediately or schedule it for later.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="schedule" className="mt-2">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="schedule" className="cursor-pointer">
                <CalendarClock className="mr-1.5 size-3.5" />
                Schedule
              </TabsTrigger>
              <TabsTrigger value="instant" className="cursor-pointer">
                <Clock className="mr-1.5 size-3.5" />
                Instant
              </TabsTrigger>
            </TabsList>

            <TabsContent value="schedule" className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="scheduled-at">Start Date & Time</Label>
                <Input
                  id="scheduled-at"
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  min={minDatetime}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="estimated-minutes">
                  Estimated Duration (minutes)
                </Label>
                <Input
                  id="estimated-minutes"
                  type="number"
                  min={1}
                  max={10080}
                  value={estimatedMinutes}
                  onChange={(e) =>
                    setEstimatedMinutes(parseInt(e.target.value) || 30)
                  }
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Discord warnings will be sent at 1h, 30m, 15m, 10m, 5m, and 1m
                before the scheduled time.
              </p>
              <DialogFooter>
                <Button
                  onClick={handleSchedule}
                  disabled={!scheduledAt || scheduleMutation.isPending}
                  className={cn(
                    "cursor-pointer bg-amber-500 hover:bg-amber-600",
                  )}
                >
                  {scheduleMutation.isPending
                    ? "Scheduling..."
                    : "Schedule Maintenance"}
                </Button>
              </DialogFooter>
            </TabsContent>

            <TabsContent value="instant" className="mt-4 space-y-4">
              <p className="text-sm text-muted-foreground">
                This will immediately clear the whitelist so only server
                operators can join. The current whitelist will be backed up and
                restored when maintenance ends.
              </p>
              <DialogFooter>
                <Button
                  onClick={handleInstantEnable}
                  disabled={toggleMutation.isPending}
                  className={cn(
                    "cursor-pointer bg-amber-500 hover:bg-amber-600",
                  )}
                >
                  {toggleMutation.isPending
                    ? "Processing..."
                    : "Enable Maintenance Now"}
                </Button>
              </DialogFooter>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
