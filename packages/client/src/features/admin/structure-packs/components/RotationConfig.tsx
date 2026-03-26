import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useToastActions } from "@/hooks/use-toast";
import { Settings, Save, Zap } from "lucide-react";
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

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export function RotationConfig() {
  const toast = useToastActions();
  const utils = trpc.useUtils();

  const configQuery = trpc.admin.structurePacks.rotationConfig.get.useQuery();
  const config = configQuery.data;

  const [dayOfWeek, setDayOfWeek] = useState<number | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [timezone, setTimezone] = useState<string | null>(null);
  const [boostUnitPrice, setBoostUnitPrice] = useState<number | null>(null);
  const [gracePeriodMinutes, setGracePeriodMinutes] = useState<number | null>(null);

  const currentDayOfWeek = dayOfWeek ?? config?.dayOfWeek ?? 1;
  const currentTime = time ?? config?.time ?? "12:00";
  const currentTimezone = timezone ?? config?.timezone ?? "UTC";
  const currentBoostUnitPrice = boostUnitPrice ?? config?.boostUnitPrice ?? 50;
  const currentGracePeriodMinutes = gracePeriodMinutes ?? config?.gracePeriodMinutes ?? 30;

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

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 font-semibold">
            <Settings className="size-4" />
            Rotation Schedule
          </h2>
          <p className="text-sm text-muted-foreground">
            Configure when packs rotate
          </p>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" className="cursor-pointer">
              <Zap className="size-4" />
              Force Rotation
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Force rotation now?</AlertDialogTitle>
              <AlertDialogDescription>
                This will immediately select and activate a new structure pack.
                All current boosts will be consumed.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="cursor-pointer">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                className="cursor-pointer"
                onClick={() => forceRotationMutation.mutate()}
                disabled={forceRotationMutation.isPending}
              >
                Rotate Now
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Day of Week</Label>
            <Select
              value={String(currentDayOfWeek)}
              onValueChange={(v) => setDayOfWeek(Number(v))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DAYS.map((day, i) => (
                  <SelectItem key={i} value={String(i)}>
                    {day}
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

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Timezone</Label>
            <Input
              value={currentTimezone}
              onChange={(e) => setTimezone(e.target.value)}
              placeholder="UTC"
            />
          </div>
          <div className="space-y-2">
            <Label>Boost Unit Price</Label>
            <Input
              type="number"
              min={1}
              value={currentBoostUnitPrice}
              onChange={(e) => setBoostUnitPrice(Number(e.target.value))}
            />
          </div>
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
            If a rotation was missed (server was down), it runs on startup if
            within this window.
          </p>
        </div>

        <Button
          className="w-full"
          onClick={() =>
            updateMutation.mutate({
              dayOfWeek: currentDayOfWeek,
              time: currentTime,
              timezone: currentTimezone,
              boostUnitPrice: currentBoostUnitPrice,
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
