import { useId, useState } from "react";
import { colorHex } from "@createrington/shared/team-prefix";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function ColorInput({
  label,
  value,
  onChange,
  disabled,
  hideLabel,
  className,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  hideLabel?: boolean;
  className?: string;
}) {
  const id = useId();
  const [typing, setTyping] = useState<string | null>(null);
  const hex = colorHex(value);

  return (
    <div
      className={cn(
        "flex flex-col gap-1.5",
        disabled && "opacity-50",
        className,
      )}
    >
      <Label
        htmlFor={id}
        className={cn("text-sm font-medium", hideLabel && "sr-only")}
      >
        {label}
      </Label>
      <div className="flex items-center gap-2">
        <label
          className={cn(
            "relative size-9 shrink-0 cursor-pointer overflow-hidden rounded-md border border-border shadow-xs",
            disabled && "cursor-not-allowed",
          )}
          style={{ background: `#${hex}` }}
        >
          <input
            type="color"
            aria-label={`${label} picker`}
            disabled={disabled}
            value={`#${hex.toLowerCase()}`}
            onChange={(event) =>
              onChange(parseInt(event.target.value.slice(1), 16))
            }
            className="absolute inset-0 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
          />
        </label>
        <div
          className={cn(
            "flex h-9 items-center overflow-hidden rounded-md border border-input bg-transparent shadow-xs focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 dark:bg-input/30",
            disabled && "pointer-events-none",
          )}
        >
          <span className="flex h-full items-center bg-muted px-2 font-mono text-xs text-muted-foreground">
            #
          </span>
          <input
            id={id}
            value={typing ?? hex}
            disabled={disabled}
            maxLength={7}
            spellCheck={false}
            autoComplete="off"
            onChange={(event) => {
              const next = event.target.value
                .replace(/[^0-9A-Fa-f]/g, "")
                .toUpperCase()
                .slice(0, 6);
              setTyping(next);
              if (next.length === 6) onChange(parseInt(next, 16));
            }}
            onBlur={() => setTyping(null)}
            className="h-full w-20 bg-transparent px-2 font-mono text-sm uppercase outline-none"
          />
        </div>
      </div>
    </div>
  );
}
