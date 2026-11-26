import { useState, type ChangeEvent } from "react";
import { trpc, queryClient, type RouterInput } from "@/lib/trpc";
import { useMutationToast } from "@/hooks/use-mutation-toast";
import { Settings, Save, Zap, Trash2 } from "lucide-react";
import { HeaderActions } from "@/features/admin/components/HeaderActions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ErrorState, LoadingState } from "@/components/query-states";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { TimezonePicker } from "@/features/admin/structure-packs/components/TimezonePicker";

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

export function RotationConfig() {
  const configQuery = useQuery(
    trpc.admin.structurePacks.rotation.config.get.queryOptions(),
  );
  const config = configQuery.data;
  const [clearOpen, setClearOpen] = useState(false);
  const [forceOpen, setForceOpen] = useState(false);

  const forceRotationMutation = useMutation(
    trpc.admin.structurePacks.rotation.force.mutationOptions({
      ...useMutationToast({ success: "Rotation triggered" }),
      onSettled: () =>
        queryClient.invalidateQueries(trpc.admin.structurePacks.pathFilter()),
    }),
  );

  const clearRotationMutation = useMutation(
    trpc.admin.structurePacks.rotation.clear.mutationOptions(
      useMutationToast({
        success: "Rotation cleared — no active structure pack",
        onSuccess: () => {
          void queryClient.invalidateQueries(
            trpc.admin.structurePacks.pathFilter(),
          );
        },
      }),
    ),
  );

  return (
    <Card className="gap-0 p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-semibold">
            <Settings className="size-4" />
            Rotation Settings
          </h2>
          <p className="text-sm text-muted-foreground">
            Global rotation schedule and weight configuration
          </p>
        </div>
        <HeaderActions>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setClearOpen(true)}
          >
            <Trash2 className="size-4" />
            Clear Rotation
          </Button>
          <ConfirmDialog
            open={clearOpen}
            onOpenChange={setClearOpen}
            title="Clear current rotation?"
            description="This will deactivate the current structure pack and remove its mods from the server. All current boosts will be cleared."
            confirmLabel="Clear Rotation"
            variant="destructive"
            onConfirm={() => clearRotationMutation.mutateAsync()}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setForceOpen(true)}
          >
            <Zap className="size-4" />
            Force Rotation
          </Button>
          <ConfirmDialog
            open={forceOpen}
            onOpenChange={setForceOpen}
            title="Force rotation now?"
            description="This will immediately select and activate a new structure pack. All current boosts will be consumed."
            confirmLabel="Rotate Now"
            onConfirm={() => forceRotationMutation.mutateAsync()}
          />
        </HeaderActions>
      </div>

      {config ? (
        <RotationForm config={config} />
      ) : configQuery.error ? (
        <ErrorState
          message={configQuery.error.message}
          onRetry={() => void configQuery.refetch()}
          compact
        />
      ) : (
        <LoadingState className="py-10" />
      )}
    </Card>
  );
}

type RotationFields = Required<
  RouterInput["admin"]["structurePacks"]["rotation"]["config"]["update"]
>;

type NumberKey =
  | "gracePeriodMinutes"
  | "timeWeightMultiplier"
  | "boostWeightPerUnit"
  | "boostUnitPrice";

const NUMBER_RULES: Record<
  NumberKey,
  { integer: boolean; min: number; minExclusive: boolean; error: string }
> = {
  gracePeriodMinutes: {
    integer: true,
    min: 0,
    minExclusive: false,
    error: "Enter a whole number of minutes, 0 or more",
  },
  timeWeightMultiplier: {
    integer: false,
    min: 0,
    minExclusive: true,
    error: "Enter a number greater than 0",
  },
  boostWeightPerUnit: {
    integer: false,
    min: 0,
    minExclusive: false,
    error: "Enter a number, 0 or more",
  },
  boostUnitPrice: {
    integer: true,
    min: 1,
    minExclusive: false,
    error: "Enter a whole number, 1 or more",
  },
};

function parseRotationNumber(key: NumberKey, text: string): number | null {
  const { integer, min, minExclusive } = NUMBER_RULES[key];
  const value = Number(text);
  if (text.trim() === "" || !Number.isFinite(value)) return null;
  if (integer && !Number.isInteger(value)) return null;
  if (minExclusive ? value <= min : value < min) return null;
  return value;
}

function RotationForm({ config }: { config: RotationFields }) {
  const [draft, setDraft] = useState<Partial<RotationFields>>({});
  const [numberText, setNumberText] = useState<
    Partial<Record<NumberKey, string>>
  >({});
  const current = { ...config, ...draft };

  const numberErrors: Partial<Record<NumberKey, string>> = {};
  const numberChanges: Partial<Record<NumberKey, number>> = {};
  for (const [key, text] of Object.entries(numberText) as [
    NumberKey,
    string,
  ][]) {
    const value = parseRotationNumber(key, text);
    if (value === null) numberErrors[key] = NUMBER_RULES[key].error;
    else if (value !== config[key]) numberChanges[key] = value;
  }
  const hasErrors = Object.keys(numberErrors).length > 0;

  const changes = {
    ...Object.fromEntries(
      Object.entries(draft).filter(
        ([key, value]) => value !== config[key as keyof RotationFields],
      ),
    ),
    ...numberChanges,
  } as Partial<RotationFields>;
  const hasChanges = Object.keys(changes).length > 0;

  const numberInput = (key: NumberKey) => ({
    value: numberText[key] ?? String(config[key]),
    "aria-invalid": numberErrors[key] !== undefined,
    onChange: (e: ChangeEvent<HTMLInputElement>) =>
      setNumberText((prev) => ({ ...prev, [key]: e.target.value })),
  });

  const set = <K extends keyof RotationFields>(
    key: K,
    value: RotationFields[K],
  ) => setDraft((prev) => ({ ...prev, [key]: value }));

  const updateMutation = useMutation(
    trpc.admin.structurePacks.rotation.config.update.mutationOptions(
      useMutationToast({
        success: "Rotation config updated",
        onSuccess: async () => {
          await queryClient.invalidateQueries(
            trpc.admin.structurePacks.rotation.config.get.pathFilter(),
          );
          setDraft({});
          setNumberText({});
        },
      }),
    ),
  );

  return (
    <div className="space-y-4">
      <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-card p-3 hover:border-border-strong">
        <Switch
          checked={current.enabled}
          onCheckedChange={(v) => set("enabled", v)}
        />
        <div className="space-y-0.5">
          <div className="text-[13px] font-medium text-foreground">
            Rotations enabled
          </div>
          <div className="text-xs text-muted-foreground">
            While off, no rotations are scheduled or executed and players cannot
            purchase boosts. Turning rotations off refunds all open boosts.
            Force Rotation still works.
          </div>
        </div>
      </label>

      <div>
        <h3 className="mb-2 text-sm font-medium text-muted-foreground">
          Schedule
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <Field>
            <FieldLabel htmlFor="rotation-period">Period</FieldLabel>
            <Select
              value={current.period}
              onValueChange={(v) =>
                set("period", v as RotationFields["period"])
              }
            >
              <SelectTrigger id="rotation-period">
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
          </Field>
          <Field>
            <FieldLabel htmlFor="rotation-time">Time</FieldLabel>
            <Input
              id="rotation-time"
              type="time"
              value={current.time}
              onChange={(e) => set("time", e.target.value)}
            />
          </Field>
        </div>

        {current.period === "weekly" && (
          <Field className="mt-4">
            <FieldLabel htmlFor="rotation-day-of-week">Day of Week</FieldLabel>
            <Select
              value={String(current.dayOfWeek)}
              onValueChange={(v) => set("dayOfWeek", Number(v))}
            >
              <SelectTrigger id="rotation-day-of-week">
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
          </Field>
        )}

        {current.period === "monthly" && (
          <Field className="mt-4">
            <FieldLabel htmlFor="rotation-day-of-month">
              Day of Month
            </FieldLabel>
            <Select
              value={String(current.dayOfMonth)}
              onValueChange={(v) => set("dayOfMonth", Number(v))}
            >
              <SelectTrigger id="rotation-day-of-month">
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
          </Field>
        )}

        <div className="mt-4 grid grid-cols-2 gap-4">
          <Field>
            <FieldLabel htmlFor="rotation-timezone">Timezone</FieldLabel>
            <TimezonePicker
              id="rotation-timezone"
              value={current.timezone}
              onChange={(v) => set("timezone", v)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="rotation-grace-period">
              Grace Period (minutes)
            </FieldLabel>
            <Input
              id="rotation-grace-period"
              type="number"
              min={0}
              {...numberInput("gracePeriodMinutes")}
            />
            <FieldError>{numberErrors.gracePeriodMinutes}</FieldError>
            <p className="text-xs text-muted-foreground">
              Catch-up window if the server was down during a scheduled rotation
            </p>
          </Field>
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium text-muted-foreground">
          Weighting
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <Field>
            <FieldLabel htmlFor="rotation-time-weight">
              Time Weight Multiplier
            </FieldLabel>
            <Input
              id="rotation-time-weight"
              type="number"
              min={0}
              step={0.1}
              {...numberInput("timeWeightMultiplier")}
            />
            <FieldError>{numberErrors.timeWeightMultiplier}</FieldError>
            <p className="text-xs text-muted-foreground">
              How much "time since last used" matters
            </p>
          </Field>
          <Field>
            <FieldLabel htmlFor="rotation-boost-weight">
              Boost Weight per Unit
            </FieldLabel>
            <Input
              id="rotation-boost-weight"
              type="number"
              min={0}
              step={0.1}
              {...numberInput("boostWeightPerUnit")}
            />
            <FieldError>{numberErrors.boostWeightPerUnit}</FieldError>
            <p className="text-xs text-muted-foreground">
              How much weight each purchased boost unit adds
            </p>
          </Field>
          <Field>
            <FieldLabel htmlFor="rotation-boost-price">
              Boost Unit Price
            </FieldLabel>
            <Input
              id="rotation-boost-price"
              type="number"
              min={1}
              {...numberInput("boostUnitPrice")}
            />
            <FieldError>{numberErrors.boostUnitPrice}</FieldError>
            <p className="text-xs text-muted-foreground">
              Currency cost per boost unit
            </p>
          </Field>
        </div>
      </div>

      <Button
        className="w-full"
        onClick={() => updateMutation.mutate(changes)}
        disabled={!hasChanges || hasErrors}
        loading={updateMutation.isPending}
      >
        <Save className="mr-1 size-4" />
        Save Config
      </Button>
    </div>
  );
}
