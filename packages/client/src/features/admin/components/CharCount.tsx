import { cn } from "@/lib/utils";

interface CharCountProps {
  value: string | undefined;
  max: number;
}

export function CharCount({ value, max }: CharCountProps) {
  const len = value?.length ?? 0;
  if (len === 0) return null;
  const warn = len > max * 0.9;
  const over = len > max;
  return (
    <span
      className={cn(
        "text-[11px] tabular-nums text-muted-foreground",
        warn && !over && "text-yellow-500",
        over && "text-destructive",
      )}
    >
      {len}/{max}
    </span>
  );
}
