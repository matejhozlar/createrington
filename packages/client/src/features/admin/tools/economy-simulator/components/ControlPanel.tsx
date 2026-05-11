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
  min?: number;
  max?: number;
  showWhen?: Mode;
};

const FIELDS: FieldConfig[] = [
  { key: "B", label: "Anchor (B)", step: 1000, min: 0 },
  {
    key: "alphaEarly",
    label: "Alpha early",
    step: 0.01,
    min: 0,
    max: 1,
    showWhen: "binary",
  },
  {
    key: "alphaModern",
    label: "Alpha modern",
    step: 0.01,
    min: 0,
    max: 1,
    showWhen: "binary",
  },
  {
    key: "alphaBase",
    label: "Alpha base",
    step: 0.01,
    min: 0,
    max: 1,
    showWhen: "sliding",
  },
  {
    key: "wT",
    label: "Tenure penalty (w_t)",
    step: 0.01,
    min: 0,
    max: 1,
    showWhen: "sliding",
  },
  {
    key: "wP",
    label: "Playtime bonus (w_p)",
    step: 0.01,
    min: 0,
    max: 1,
    showWhen: "sliding",
  },
  {
    key: "tenureCapDays",
    label: "Tenure cap (days)",
    step: 1,
    min: 1,
    showWhen: "sliding",
  },
  { key: "alphaMin", label: "Alpha min (clamp)", step: 0.01, min: 0, max: 1 },
  { key: "alphaMax", label: "Alpha max (clamp)", step: 0.01, min: 0, max: 1 },
];

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
          <Label htmlFor="mode">Mode</Label>
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
          <Label htmlFor="cutoff-date">Cutoff date</Label>
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
              <Label htmlFor={field.key}>{field.label}</Label>
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
