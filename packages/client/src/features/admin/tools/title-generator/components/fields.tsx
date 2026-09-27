import { useId } from "react";
import { Layers } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LabeledSwitch } from "@/components/labeled-switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { BlendMode } from "../engine/types";

const BLEND_MODES: { value: BlendMode; label: string }[] = [
  { value: "multiply", label: "Multiply" },
  { value: "color", label: "Colour" },
  { value: "lighter", label: "Lighter" },
  { value: "screen", label: "Screen" },
  { value: "overlay", label: "Overlay" },
  { value: "soft-light", label: "Soft Light" },
  { value: "hue", label: "Hue" },
  { value: "saturation", label: "Saturation" },
  { value: "difference", label: "Difference" },
  { value: "source-over", label: "Source Over" },
];

export function Section({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {title}
          </h3>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function SliderField({
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  const id = useId();
  const clamp = (next: number) => Math.min(max, Math.max(min, next));
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
      </Label>
      <div className="flex items-center gap-3">
        <input
          type="range"
          aria-label={label}
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className="h-2 min-w-0 flex-1 cursor-pointer accent-primary"
        />
        <div className="relative w-24 shrink-0">
          <Input
            id={id}
            type="number"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(event) => {
              const next = Number(event.target.value);
              if (Number.isFinite(next)) onChange(clamp(next));
            }}
            className={cn("tabular-nums", suffix && "pr-7")}
          />
          {suffix && (
            <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-sm text-muted-foreground">
              {suffix}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function toColorInputValue(value: string) {
  const hex = value.replace("#", "");
  if (/^[0-9a-f]{3}$/i.test(hex)) {
    return `#${hex
      .split("")
      .map((char) => char + char)
      .join("")}`.toLowerCase();
  }
  return /^[0-9a-f]{6}$/i.test(hex) ? `#${hex.toLowerCase()}` : "#000000";
}

export function ColourField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className={cn("flex flex-col gap-1.5", disabled && "opacity-50")}>
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
      </Label>
      <div className="flex items-center gap-2">
        <label
          className={cn(
            "relative size-9 shrink-0 cursor-pointer overflow-hidden rounded-md border border-border",
            disabled && "cursor-not-allowed",
          )}
          style={{ background: toColorInputValue(value) }}
        >
          <input
            type="color"
            aria-label={label}
            disabled={disabled}
            value={toColorInputValue(value)}
            onChange={(event) => onChange(event.target.value.toUpperCase())}
            className="absolute inset-0 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
          />
        </label>
        <Input
          id={id}
          value={value}
          disabled={disabled}
          maxLength={7}
          onChange={(event) => {
            const next = event.target.value.trim();
            onChange(next.startsWith("#") ? next : `#${next}`);
          }}
          className="w-28 font-mono uppercase"
        />
      </div>
    </div>
  );
}

export function ToggleField({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <LabeledSwitch
      id={id}
      label={label}
      checked={checked}
      disabled={disabled}
      onCheckedChange={onChange}
      className="w-fit"
    />
  );
}

export function ChoiceField<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T;
  options: readonly { value: T; label: string; disabled?: boolean }[];
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <Tabs value={value} onValueChange={(next) => onChange(next as T)}>
      <div className="overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <TabsList className={className}>
          {options.map((option) => (
            <TabsTrigger
              key={option.value}
              value={option.value}
              disabled={option.disabled}
              className="cursor-pointer text-foreground/80"
            >
              {option.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
    </Tabs>
  );
}

export function BlendField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: BlendMode;
  onChange: (value: BlendMode) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      <Select
        value={value}
        onValueChange={(next) => onChange(next as BlendMode)}
      >
        <SelectTrigger className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {BLEND_MODES.map((mode) => (
            <SelectItem key={mode.value} value={mode.value}>
              {mode.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export type AssetOption = {
  id: string;
  name: string;
  author?: string;
  image?: string;
  pixelated?: boolean;
  hasVariants?: boolean;
};

export function AssetGrid({
  options,
  selected,
  onSelect,
  tile = false,
}: {
  options: AssetOption[];
  selected: string | null;
  onSelect: (id: string) => void;
  tile?: boolean;
}) {
  return (
    <div className="grid max-h-[26rem] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3 xl:grid-cols-4">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onSelect(option.id)}
          title={
            option.author ? `${option.name} by ${option.author}` : option.name
          }
          className={cn(
            "relative flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border border-border bg-card p-2 text-center transition-colors hover:border-primary/40 focus-visible:border-primary/40 focus-visible:outline-none",
            selected === option.id && "border-primary hover:border-primary",
          )}
        >
          {option.image && (
            <img
              src={option.image}
              alt=""
              loading="lazy"
              className={cn(
                "h-12 w-full object-contain",
                tile && "w-12 rounded-sm object-cover",
                option.pixelated && "[image-rendering:pixelated]",
              )}
            />
          )}
          <span className="line-clamp-2 text-xs font-medium">
            {option.name}
          </span>
          {option.hasVariants && (
            <Layers
              aria-label="Has variants"
              className="absolute top-1.5 right-1.5 size-3.5 text-muted-foreground"
            />
          )}
        </button>
      ))}
    </div>
  );
}
