import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface TugSide {
  value: number;
  text: string;
}

const SIZES = {
  lg: {
    grid: "py-3.5 md:grid-cols-[10rem_minmax(0,1fr)_10rem]",
    value: "text-base md:text-xl",
    label:
      "text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground md:text-[11px]",
    bar: "h-2 md:h-2.5",
  },
  sm: {
    grid: "py-2.5 md:grid-cols-[7.5rem_minmax(0,1fr)_7.5rem]",
    value: "text-sm md:text-[15px]",
    label: "truncate text-[13px] text-foreground/85",
    bar: "h-1.5",
  },
} as const;

export function TugRow({
  label,
  left,
  right,
  size,
}: {
  label: ReactNode;
  left: TugSide;
  right: TugSide;
  size: keyof typeof SIZES;
}) {
  const styles = SIZES[size];
  const total = left.value + right.value;
  const leftShare = total > 0 ? (left.value / total) * 100 : 50;
  const leftWins = left.value > right.value;
  const rightWins = right.value > left.value;

  return (
    <div
      className={cn(
        "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 border-b border-white/5 last:border-b-0 md:gap-x-5",
        styles.grid,
      )}
    >
      <span
        className={cn(
          "tabular-nums md:row-span-2",
          styles.value,
          leftWins
            ? "font-bold text-(--left)"
            : "font-medium text-muted-foreground",
        )}
      >
        {left.text}
      </span>
      <span className={cn("min-w-0 text-center", styles.label)}>{label}</span>
      <span
        className={cn(
          "text-right tabular-nums md:row-span-2",
          styles.value,
          rightWins
            ? "font-bold text-(--right)"
            : "font-medium text-muted-foreground",
        )}
      >
        {right.text}
      </span>
      <div
        aria-hidden
        className={cn(
          "col-span-3 flex gap-[3px] md:col-span-1 md:col-start-2",
          styles.bar,
        )}
      >
        <div
          className={cn(
            "rounded-l-full rounded-r-[2px] bg-(--left) transition-[width] duration-500",
            !leftWins && "opacity-35",
          )}
          style={{ width: `${leftShare}%` }}
        />
        <div
          className={cn(
            "rounded-l-[2px] rounded-r-full bg-(--right) transition-[width] duration-500",
            !rightWins && "opacity-35",
          )}
          style={{ width: `${100 - leftShare}%` }}
        />
      </div>
    </div>
  );
}
