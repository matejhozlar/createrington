import { useState, type ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { clamp } from "@/lib/math";

type ClampedNumberInputProps = Omit<
  ComponentProps<typeof Input>,
  "type" | "value" | "onChange" | "min" | "max"
> & {
  value: number;
  min: number;
  max: number;
  integer?: boolean;
  onValueChange: (value: number) => void;
};

export function ClampedNumberInput({
  value,
  min,
  max,
  integer = false,
  onValueChange,
  onBlur,
  ...props
}: ClampedNumberInputProps) {
  const [text, setText] = useState<string | null>(null);

  const parse = (raw: string) => {
    const parsed = Number(raw);
    if (raw.trim() === "" || !Number.isFinite(parsed)) return null;
    return integer ? Math.round(parsed) : parsed;
  };

  return (
    <Input
      {...props}
      type="number"
      min={min}
      max={max}
      value={text ?? value}
      onChange={(event) => {
        setText(event.target.value);
        const next = parse(event.target.value);
        if (next !== null && next >= min && next <= max) onValueChange(next);
      }}
      onBlur={(event) => {
        const next = text === null ? null : parse(text);
        if (next !== null) onValueChange(clamp(next, min, max));
        setText(null);
        onBlur?.(event);
      }}
    />
  );
}
