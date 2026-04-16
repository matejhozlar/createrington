import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useToastActions } from "@/hooks/use-toast";
import { Settings, Save, Zap, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

const DAYS_OF_WEEK = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const PERIODS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

const DAYS_OF_MONTH = Array.from({ length: 28 }, (_, i) => i + 1);

/** Admin panel card for viewing and updating the structure pack rotation schedule and weighting parameters. */
export function RotationConfig() {
  const toast = useToastActions();
  const utils = trpc.useUtils();

  const configQuery = trpc.admin.structurePacks.rotationConfig.get.useQuery();
  const config = configQuery.data;

  // Local state is null until the user edits a field; the resolved `current*`
  // values below fall back to the server config so the form always reflects
  // the saved state before any edits are made.
  const [period, setPeriod] = useState<string | null>(null);
  const [dayOfWeek, setDayOfWeek] = useState<number | null>(null);
  const [dayOfMonth, setDayOfMonth] = useState<number | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [timezone, setTimezone] = useState<string | null>(null);
  const [boostUnitPrice, setBoostUnitPrice] = useState<number | null>(null);
  const [timeWeightMultiplier, setTimeWeightMultiplier] = useState<
    number | null
  >(null);
  const [boostWeightPerUnit, setBoostWeightPerUnit] = useState<number | null>(
    null,
  );
  const [gracePeriodMinutes, setGracePeriodMinutes] = useState<number | null>(
    null,
  );

  const currentPeriod = period ?? config?.period ?? "weekly";
  const currentDayOfWeek = dayOfWeek ?? config?.dayOfWeek ?? 1;
  const currentDayOfMonth = dayOfMonth ?? config?.dayOfMonth ?? 1;
  const currentTime = time ?? config?.time ?? "12:00";
  const currentTimezone = timezone ?? config?.timezone ?? "UTC";
  const currentBoostUnitPrice = boostUnitPrice ?? config?.boostUnitPrice ?? 50;
  const currentTimeWeightMultiplier =
    timeWeightMultiplier ?? config?.timeWeightMultiplier ?? 1.0;
  const currentBoostWeightPerUnit =
    boostWeightPerUnit ?? config?.boostWeightPerUnit ?? 1.0;
  const currentGracePeriodMinutes =
    gracePeriodMinutes ?? config?.gracePeriodMinutes ?? 30;

  const updateMutation =
    trpc.admin.structurePacks.rotationConfig.update.useMutation({
      onSuccess: () => {
        toast.success("Rotation config updated");
        utils.admin.structurePacks.rotationConfig.get.invalidate();
      },
      onError: (err) => toast.error(err.message),
    });

  const forceRotationMutation =
    trpc.admin.structurePacks.forceRotation.useMutation({
      onSuccess: () => {
        toast.success("Rotation triggered");
        utils.admin.structurePacks.list.invalidate();
        utils.admin.structurePacks.rotationConfig.get.invalidate();
      },
      onError: (err) => toast.error(err.message),
    });

  const clearRotationMutation =
    trpc.admin.structurePacks.clearRotation.useMutation({
      onSuccess: () => {
        toast.success("Rotation cleared — no active structure pack");
        utils.admin.structurePacks.list.invalidate();
        utils.admin.structurePacks.rotationConfig.get.invalidate();
      },
      onError: (err) => toast.error(err.message),
    });

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 font-semibold">
            <Settings className="size-4" />
            Rotation Settings
          </h2>
          <p className="text-sm text-muted-foreground">
            Global rotation schedule and weight configuration
          </p>
        </div>
        <div className="flex gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="size-4" />
                Clear Rotation
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear current rotation?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will deactivate the current structure pack and remove its
                  mods from the server. All current boosts will be cleared.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => clearRotationMutation.mutate()}
                  disabled={clearRotationMutation.isPending}
                >
                  Clear Rotation
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Zap className="size-4" />
                Force Rotation
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Force rotation now?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will immediately select and activate a new structure
                  pack. All current boosts will be consumed.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => forceRotationMutation.mutate()}
                  disabled={forceRotationMutation.isPending}
                >
                  Rotate Now
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="space-y-4">
        {/* Schedule section */}
        <div>
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">
            Schedule
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Period</Label>
              <Select value={currentPeriod} onValueChange={(v) => setPeriod(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIODS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Time</Label>
              <Input
                type="time"
                value={currentTime}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>

          {currentPeriod === "weekly" && (
            <div className="mt-4 space-y-2">
              <Label>Day of Week</Label>
              <Select
                value={String(currentDayOfWeek)}
                onValueChange={(v) => setDayOfWeek(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAYS_OF_WEEK.map((day, i) => (
                    <SelectItem key={i} value={String(i)}>
                      {day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {currentPeriod === "monthly" && (
            <div className="mt-4 space-y-2">
              <Label>Day of Month</Label>
              <Select
                value={String(currentDayOfMonth)}
                onValueChange={(v) => setDayOfMonth(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAYS_OF_MONTH.map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Max 28 to avoid issues with shorter months
              </p>
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Timezone</Label>
              <Input
                value={currentTimezone}
                onChange={(e) => setTimezone(e.target.value)}
                placeholder="UTC"
              />
            </div>
            <div className="space-y-2">
              <Label>Grace Period (minutes)</Label>
              <Input
                type="number"
                min={0}
                value={currentGracePeriodMinutes}
                onChange={(e) => setGracePeriodMinutes(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                Catch-up window if the server was down during a scheduled
                rotation
              </p>
            </div>
          </div>
        </div>

        {/* Weighting section */}
        <div>
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">
            Weighting
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Time Weight Multiplier</Label>
              <Input
                type="number"
                min={0}
                step={0.1}
                value={currentTimeWeightMultiplier}
                onChange={(e) =>
                  setTimeWeightMultiplier(Number(e.target.value))
                }
              />
              <p className="text-xs text-muted-foreground">
                How much "time since last used" matters
              </p>
            </div>
            <div className="space-y-2">
              <Label>Boost Weight per Unit</Label>
              <Input
                type="number"
                min={0}
                step={0.1}
                value={currentBoostWeightPerUnit}
                onChange={(e) => setBoostWeightPerUnit(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                How much weight each purchased boost unit adds
              </p>
            </div>
            <div className="space-y-2">
              <Label>Boost Unit Price</Label>
              <Input
                type="number"
                min={1}
                value={currentBoostUnitPrice}
                onChange={(e) => setBoostUnitPrice(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                Currency cost per boost unit
              </p>
            </div>
          </div>
        </div>

        <Button
          className="w-full"
          onClick={() =>
            updateMutation.mutate({
              period: currentPeriod as "daily" | "weekly" | "monthly",
              dayOfWeek: currentDayOfWeek,
              dayOfMonth: currentDayOfMonth,
              time: currentTime,
              timezone: currentTimezone,
              boostUnitPrice: currentBoostUnitPrice,
              timeWeightMultiplier: currentTimeWeightMultiplier,
              boostWeightPerUnit: currentBoostWeightPerUnit,
              gracePeriodMinutes: currentGracePeriodMinutes,
            })
          }
          disabled={updateMutation.isPending}
        >
          <Save className="mr-1 size-4" />
          Save Config
        </Button>
      </div>
    </div>
  );
}
