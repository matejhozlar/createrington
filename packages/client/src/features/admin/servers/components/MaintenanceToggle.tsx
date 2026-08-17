import { useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarClock, Clock, Wrench, X } from "lucide-react";
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
 * - State A: Inactive, offers instant enable or scheduled enable via a dialog
 * - State B: Scheduled, shows countdown and a cancel confirmation
 * - State C: Active, shows active indicator and a disable confirmation
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
  const [announceEnd, setAnnounceEnd] = useState(false);
  const [maintenanceType, setMaintenanceType] = useState<
    "maintenance" | "modpack_update"
  >("maintenance");
  const [scheduledAt, setScheduledAt] = useState("");
  const [estimatedMinutes, setEstimatedMinutes] = useState(30);
  const utils = trpc.useUtils();

  // Min datetime for the input (1 minute from now, recomputed when the dialog opens)
  const [minDatetime, setMinDatetime] = useState("");

  const handleScheduleDialogOpenChange = (open: boolean) => {
    if (open) {
      setMinDatetime(new Date(Date.now() + 60000).toISOString().slice(0, 16));
    }
    setDialogOpen(open);
  };

  const { data: status } = trpc.admin.servers.maintenanceStatus.useQuery(
    { serverId },
    { refetchInterval: 15_000 },
  );

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
        data.enabled ? "Maintenance mode enabled" : "Maintenance mode disabled",
      );
      invalidate();
    },
    onError: (err: { message: string }) => toast.error(err.message),
    onSettled: () => {
      setDialogOpen(false);
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
      },
      onError: (err: { message: string }) => toast.error(err.message),
      onSettled: () => {
        invalidate();
      },
    });

  function handleInstantEnable() {
    toggleMutation.mutate({ serverId, enabled: true });
  }

  function handleSchedule() {
    if (!scheduledAt) return;
    const date = new Date(scheduledAt);
    scheduleMutation.mutate({
      serverId,
      type: maintenanceType,
      scheduledAt: date.toISOString(),
      estimatedMinutes,
    });
  }

  // State B: Scheduled (not yet active)
  if (schedule?.status === "scheduled") {
    return (
      <div className="flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
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

        <Button
          variant="outline"
          size="sm"
          onClick={() => setCancelDialogOpen(true)}
        >
          <X className="mr-1 size-3.5" />
          Cancel
        </Button>
        <ConfirmDialog
          open={cancelDialogOpen}
          onOpenChange={setCancelDialogOpen}
          title="Cancel scheduled maintenance?"
          description="The scheduled maintenance and all pending Discord warnings will be cancelled."
          confirmLabel="Cancel Schedule"
          cancelLabel="Keep Schedule"
          variant="destructive"
          onConfirm={() => cancelMutation.mutateAsync({ serverId })}
        />
      </div>
    );
  }

  // State C: Active maintenance
  if (isMaintenance) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
        <div className="flex items-center gap-3">
          <Wrench className="size-5 text-amber-500" />
          <div>
            <p className="text-sm font-medium">
              Maintenance Mode{" "}
              <span className="font-semibold text-amber-500">Active</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Whitelist is cleared
            </p>
          </div>
        </div>

        <Button
          variant="warning"
          size="sm"
          onClick={() => setDisableDialogOpen(true)}
        >
          Disable
        </Button>
        <ConfirmDialog
          open={disableDialogOpen}
          onOpenChange={setDisableDialogOpen}
          title="Disable maintenance mode?"
          description="This will restore the whitelist file and reload it. All previously whitelisted players will be able to join again."
          confirmLabel="Disable"
          onConfirm={() =>
            toggleMutation.mutateAsync({
              serverId,
              enabled: false,
              announce: announceEnd,
            })
          }
        >
          <div className="flex items-center gap-2">
            <Checkbox
              id="announce-end"
              checked={announceEnd}
              onCheckedChange={(checked) => setAnnounceEnd(checked === true)}
            />
            <Label htmlFor="announce-end" className="text-sm cursor-pointer">
              Send &quot;maintenance ended&quot; announcement to Discord
            </Label>
          </div>
        </ConfirmDialog>
      </div>
    );
  }

  // State A: No maintenance, no schedule
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
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

      <Dialog open={dialogOpen} onOpenChange={handleScheduleDialogOpenChange}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
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
                <Label>Type</Label>
                <Select
                  value={maintenanceType}
                  onValueChange={(v) =>
                    setMaintenanceType(v as "maintenance" | "modpack_update")
                  }
                >
                  <SelectTrigger className="cursor-pointer">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="maintenance">
                      Server Maintenance
                    </SelectItem>
                    <SelectItem value="modpack_update">
                      Modpack & Server Update
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
                  variant="warning"
                  onClick={handleSchedule}
                  disabled={!scheduledAt || scheduleMutation.isPending}
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
                  variant="warning"
                  onClick={handleInstantEnable}
                  disabled={toggleMutation.isPending}
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
