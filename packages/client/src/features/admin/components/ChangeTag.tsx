import { cn } from "@/lib/utils";

export function ChangeTag({
  label,
  color,
  className,
}: {
  label: string;
  color: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "mt-0.5 inline-flex h-5 min-w-16 shrink-0 items-center justify-center rounded-[5px] border px-2 font-mono text-[10.5px] font-medium uppercase tracking-[0.06em]",
        className,
      )}
      style={{
        color,
        background: `oklch(from ${color} l c h / 0.1)`,
        borderColor: `oklch(from ${color} l c h / 0.25)`,
      }}
    >
      {label}
    </span>
  );
}
