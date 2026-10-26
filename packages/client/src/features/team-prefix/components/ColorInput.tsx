import { useState, type ReactNode } from "react";
import { colorHex } from "@createrington/shared/team-prefix";
import { cn } from "@/lib/utils";

export function ColorInput({
  label,
  value,
  onChange,
  children,
  className,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  children: ReactNode;
  className?: string;
}) {
  const [typing, setTyping] = useState<string | null>(null);
  const hex = colorHex(value);

  return (
    <div className={cn("flex items-center gap-3.5 px-3.5", className)}>
      <label
        className="relative size-10 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-(--border-strong)"
        style={{ background: `#${hex}` }}
      >
        <input
          type="color"
          aria-label={`${label} colour`}
          value={`#${hex.toLowerCase()}`}
          onChange={(event) =>
            onChange(parseInt(event.target.value.slice(1), 16))
          }
          className="absolute inset-0 size-full cursor-pointer opacity-0"
        />
      </label>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">{children}</div>
      <div className="flex h-10 items-center overflow-hidden rounded-[10px] border border-input bg-white/[4.5%] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
        <span className="pl-2.5 font-mono text-sm text-muted-foreground">
          #
        </span>
        <input
          value={typing ?? hex}
          maxLength={7}
          spellCheck={false}
          autoComplete="off"
          aria-label={`${label} hex`}
          onChange={(event) => {
            const next = event.target.value
              .replace(/[^0-9A-Fa-f]/g, "")
              .toUpperCase()
              .slice(0, 6);
            setTyping(next);
            if (next.length === 6) onChange(parseInt(next, 16));
          }}
          onBlur={() => setTyping(null)}
          className="h-full w-[76px] bg-transparent pr-2.5 pl-1 font-mono text-base uppercase outline-none"
        />
      </div>
    </div>
  );
}
