import { cn } from "@/lib/utils";

export function Kbd({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <kbd
      className={cn(
        "rounded-[5px] border border-border px-1.25 py-px font-mono text-[11px] text-muted-foreground",
        className,
      )}
    >
      {children}
    </kbd>
  );
}
