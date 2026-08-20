import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToastActions } from "@/hooks/use-toast";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

type IntakeMode = "auto" | "closed";

const INTAKE_MODE_OPTIONS: { value: IntakeMode; label: string }[] = [
  { value: "auto", label: "Auto (capacity-based)" },
  { value: "closed", label: "Closed (force waitlist)" },
];

export function IntakeSettingsCard() {
  const toast = useToastActions();
  const utils = trpc.useUtils();
  const settingsQuery = trpc.admin.settings.get.useQuery();
  const updateSettings = trpc.admin.settings.update.useMutation();

  const [limitDraft, setLimitDraft] = useState<string | null>(null);

  const data = settingsQuery.data;
  const limitValue = limitDraft ?? (data ? String(data.playerLimit) : "");
  const limitChanged =
    data !== undefined &&
    limitDraft !== null &&
    limitDraft !== String(data.playerLimit);

  const isOpen =
    data !== undefined &&
    data.intakeMode === "auto" &&
    data.playerCount + data.reservedSlots < data.playerLimit;

  const saveLimit = async () => {
    const parsed = Number(limitValue);
    if (
      limitValue.trim() === "" ||
      !Number.isInteger(parsed) ||
      parsed < 0 ||
      parsed > 1000
    ) {
      toast.error("Player limit must be a whole number between 0 and 1000");
      return;
    }
    try {
      await updateSettings.mutateAsync({ playerLimit: parsed });
      setLimitDraft(null);
      await utils.admin.settings.get.invalidate();
      toast.success("Player limit updated");
    } catch {
      toast.error("Failed to update player limit");
    }
  };

  const changeMode = async (mode: IntakeMode) => {
    try {
      await updateSettings.mutateAsync({ intakeMode: mode });
      await utils.admin.settings.get.invalidate();
      toast.success(mode === "closed" ? "Intake closed" : "Intake set to auto");
    } catch {
      toast.error("Failed to update intake mode");
    }
  };

  return (
    <Card className="gap-2">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <SlidersHorizontal className="size-4 text-muted-foreground" />
          Intake Settings
          {data && (
            <>
              <Badge
                variant="outline"
                className={cn(
                  isOpen
                    ? "border-success bg-success/10 text-success"
                    : "border-amber-500 bg-amber-500/10 text-amber-500",
                )}
              >
                {isOpen ? "Open" : "Waitlist"}
              </Badge>
              <span className="text-xs font-normal text-muted-foreground">
                {data.playerCount} / {data.playerLimit} players
                {data.reservedSlots > 0 && ` · ${data.reservedSlots} reserved`}
              </span>
            </>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-end gap-4">
          <Field className="w-40">
            <FieldLabel htmlFor="player-limit">Player Limit</FieldLabel>
            <Input
              id="player-limit"
              type="number"
              min={0}
              max={1000}
              value={limitValue}
              disabled={!data}
              onChange={(e) => setLimitDraft(e.target.value)}
            />
          </Field>
          <Button
            onClick={saveLimit}
            disabled={!limitChanged}
            loading={updateSettings.isPending && limitChanged}
          >
            Save
          </Button>

          <Field className="w-56">
            <FieldLabel htmlFor="intake-mode">Intake Mode</FieldLabel>
            <Select
              value={data?.intakeMode ?? ""}
              onValueChange={(v) => changeMode(v as IntakeMode)}
              disabled={!data || updateSettings.isPending}
            >
              <SelectTrigger id="intake-mode" className="w-full">
                <SelectValue placeholder="Loading..." />
              </SelectTrigger>
              <SelectContent>
                {INTAKE_MODE_OPTIONS.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    className="cursor-pointer"
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      </CardContent>
    </Card>
  );
}
