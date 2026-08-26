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
import {
  CalendarClock,
  Clock,
  Settings2,
  Wrench,
  WifiOff,
  X,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useToastActions } from "@/hooks/use-toast";
import { useCountdown } from "@/hooks/use-countdown";
import { MaintenanceSettingsDialog } from "./MaintenanceSettingsDialog";

interface MaintenanceToggleProps {
  serverId: number;
  isMaintenance: boolean;
}

export function MaintenanceToggle({
  serverId,
  isMaintenance,
}: MaintenanceToggleProps) {
  const toast = useToastActions();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [disableDialogOpen, setDisableDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [announceEnd, setAnnounceEnd] = useState(false);
  const [untilRestart, setUntilRestart] = useState(false);
  const [maintenanceType, setMaintenanceType] = useState<
    "maintenance" | "modpack_update"
  >("maintenance");
  const [scheduledAt, setScheduledAt] = useState("");
  const [estimatedMinutes, setEstimatedMinutes] = useState(30);
  const utils = trpc.useUtils();

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
  const countdown = useCountdown(
    schedule?.status === "scheduled" ? schedule.scheduledAt : null,
  );

  const invalidate = () => {
    utils.admin.servers.get.invalidate({ id: serverId });
    utils.admin.servers.list.invalidate();
    utils.admin.servers.maintenanceStatus.invalidate({ serverId });
  };

  const toggleMutation = trpc.admin.servers.toggleMaintenance.useMutation({
    onSuccess: (data) => {
      if (!data.enabled) {
        toast.success("Maintenance mode disabled");
      } else if (data.applied) {
        toast.success("Maintenance mode enabled");
      } else {
        toast.warning(
          "Maintenance mode armed. The server is unreachable right now; it will be applied as soon as it's back online.",
        );
      }
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
    toggleMutation.mutate({ serverId, enabled: true, untilRestart });
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

  const settingsButton = (
    <Button
      variant="ghost"
      size="sm"
      aria-label="Maintenance settings"
      onClick={() => setSettingsOpen(true)}
    >
      <Settings2 className="size-4" />
    </Button>
  );

  const settingsDialog = (
    <MaintenanceSettingsDialog
      serverId={serverId}
      open={settingsOpen}
      onOpenChange={setSettingsOpen}
    />
  );

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
              })}
              {schedule.estimatedMinutes !== null &&
                ` · ~${schedule.estimatedMinutes} min`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {settingsButton}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCancelDialogOpen(true)}
          >
            <X className="mr-1 size-3.5" />
            Cancel
          </Button>
        </div>
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
        {settingsDialog}
      </div>
    );
  }

  // State C: Active maintenance
  if (isMaintenance || status?.enabled) {
    const pending = status?.pendingApply ?? false;
    const detail = pending
      ? "Waiting for the server to come back online to apply"
      : schedule?.untilRestart
        ? "Only allowed players can join · turns off at the next restart"
        : "Only allowed players can join";

    return (
      <div className="flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
        <div className="flex items-center gap-3">
          {pending ? (
            <WifiOff className="size-5 text-amber-500" />
          ) : (
            <Wrench className="size-5 text-amber-500" />
          )}
          <div>
            <p className="text-sm font-medium">
              Maintenance Mode{" "}
              <span className="font-semibold text-amber-500">
                {pending ? "Pending" : "Active"}
              </span>
            </p>
            <p className="text-xs text-muted-foreground">{detail}</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {settingsButton}
          <Button
            variant="warning"
            size="sm"
            onClick={() => setDisableDialogOpen(true)}
          >
            Disable
          </Button>
        </div>
        <ConfirmDialog
          open={disableDialogOpen}
          onOpenChange={setDisableDialogOpen}
          title="Disable maintenance mode?"
          description="Maintenance mode will be turned off on the server and every whitelisted player will be able to join again."
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
        {settingsDialog}
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
            Turn on to kick everyone except allowed players and block new joins
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1">
        {settingsButton}
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
                Choose to start maintenance immediately or schedule it for
                later.
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
                    disabled={!scheduledAt}
                    loading={scheduleMutation.isPending}
                  >
                    Schedule Maintenance
                  </Button>
                </DialogFooter>
              </TabsContent>

              <TabsContent value="instant" className="mt-4 space-y-4">
                <p className="text-sm text-muted-foreground">
                  Turns maintenance mode on right away. Everyone who is not on
                  the allow list is kicked and can&apos;t join until it&apos;s
                  turned off.
                </p>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="until-restart"
                    checked={untilRestart}
                    onCheckedChange={(checked) =>
                      setUntilRestart(checked === true)
                    }
                  />
                  <Label
                    htmlFor="until-restart"
                    className="text-sm cursor-pointer"
                  >
                    Turn off automatically at the next server restart
                  </Label>
                </div>
                <DialogFooter>
                  <Button
                    variant="warning"
                    onClick={handleInstantEnable}
                    loading={toggleMutation.isPending}
                  >
                    Enable Maintenance Now
                  </Button>
                </DialogFooter>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>
      {settingsDialog}
    </div>
  );
}
