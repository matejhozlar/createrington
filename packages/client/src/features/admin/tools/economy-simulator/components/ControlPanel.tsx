import { HelpCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Mode, SimulatorParams } from "../types";

type Props = {
  params: SimulatorParams;
  onChange: (next: SimulatorParams) => void;
};

type NumericField = Exclude<keyof SimulatorParams, "mode" | "cutoffDate">;

type FieldConfig = {
  key: NumericField;
  label: string;
  step: number;
  tooltip: string;
  min?: number;
  max?: number;
  showWhen?: Mode;
};

const MODE_TOOLTIP =
  "Sliding blends tenure and playtime to derive each player's alpha. Binary picks one of two fixed alphas based on whether the player joined on or before the cutoff.";

const CUTOFF_TOOLTIP =
  "Date the OP feature was removed (default 2026-03-17). Splits players into Early (had access) vs Modern.";

const FIELDS: FieldConfig[] = [
  {
    key: "B",
    label: "Anchor (B)",
    step: 1000,
    min: 0,
    tooltip:
      "Balances at or below B are left unchanged. Above B, the power-law compression kicks in. Higher B leaves more players untouched.",
  },
  {
    key: "alphaEarly",
    label: "Alpha early",
    step: 0.01,
    min: 0,
    max: 1,
    showWhen: "binary",
    tooltip:
      "Alpha applied to players who joined on or before the cutoff. Lower means more compression for the early bucket.",
  },
  {
    key: "alphaModern",
    label: "Alpha modern",
    step: 0.01,
    min: 0,
    max: 1,
    showWhen: "binary",
    tooltip:
      "Alpha applied to players who joined after the cutoff. Lower means more compression for the modern bucket.",
  },
  {
    key: "alphaBase",
    label: "Alpha base",
    step: 0.01,
    min: 0,
    max: 1,
    showWhen: "sliding",
    tooltip:
      "Starting alpha before tenure and playtime adjustments. Higher means lighter compression overall.",
  },
  {
    key: "wT",
    label: "Tenure penalty (w_t)",
    step: 0.01,
    min: 0,
    max: 1,
    showWhen: "sliding",
    tooltip:
      "How much OP-era tenure drags alpha down. Higher means harsher compression for long-tenured early players.",
  },
  {
    key: "wP",
    label: "Playtime bonus (w_p)",
    step: 0.01,
    min: 0,
    max: 1,
    showWhen: "sliding",
    tooltip:
      "How much OP-era playtime lifts alpha back up. Higher means more protection for legitimate grinders.",
  },
  {
    key: "tenureCapDays",
    label: "Tenure cap (days)",
    step: 1,
    min: 1,
    showWhen: "sliding",
    tooltip:
      "Days of OP-era tenure at which tenure_score saturates at 1. Lower cap means the penalty maxes out sooner.",
  },
  {
    key: "alphaMin",
    label: "Alpha min (clamp)",
    step: 0.01,
    min: 0,
    max: 1,
    tooltip:
      "Hard floor on alpha after all adjustments. Raising the floor reduces variance between players.",
  },
  {
    key: "alphaMax",
    label: "Alpha max (clamp)",
    step: 0.01,
    min: 0,
    max: 1,
    tooltip:
      "Hard ceiling on alpha after all adjustments. Lowering the ceiling reduces variance between players.",
  },
];

type LabelWithTooltipProps = {
  htmlFor: string;
  label: string;
  tooltip: string;
};

function LabelWithTooltip({ htmlFor, label, tooltip }: LabelWithTooltipProps) {
  return (
    <div className="flex items-center gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={`What is ${label}?`}
            className="text-muted-foreground hover:text-foreground focus-visible:text-foreground focus-visible:outline-none"
          >
            <HelpCircle className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-xs">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

export function ControlPanel({ params, onChange }: Props) {
  const setField = (key: NumericField, value: number) => {
    onChange({ ...params, [key]: value });
  };

  return (
    <Card className="gap-2">
      <CardHeader>
        <CardTitle>Parameters</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <LabelWithTooltip
            htmlFor="mode"
            label="Mode"
            tooltip={MODE_TOOLTIP}
          />
          <Select
            value={params.mode}
            onValueChange={(value) =>
              onChange({ ...params, mode: value as Mode })
            }
          >
            <SelectTrigger id="mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sliding">Sliding</SelectItem>
              <SelectItem value="binary">Binary</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <LabelWithTooltip
            htmlFor="cutoff-date"
            label="Cutoff date"
            tooltip={CUTOFF_TOOLTIP}
          />
          <Input
            id="cutoff-date"
            type="date"
            value={params.cutoffDate}
            onChange={(e) =>
              onChange({ ...params, cutoffDate: e.target.value })
            }
          />
        </div>

        {FIELDS.filter((f) => !f.showWhen || f.showWhen === params.mode).map(
          (field) => (
            <div key={field.key} className="flex flex-col gap-2">
              <LabelWithTooltip
                htmlFor={field.key}
                label={field.label}
                tooltip={field.tooltip}
              />
              <Input
                id={field.key}
                type="number"
                step={field.step}
                min={field.min}
                max={field.max}
                value={params[field.key]}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  if (Number.isFinite(next)) setField(field.key, next);
                }}
              />
            </div>
          ),
        )}
      </CardContent>
    </Card>
  );
}
