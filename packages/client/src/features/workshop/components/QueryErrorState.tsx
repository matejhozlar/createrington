import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function QueryErrorState({
  message,
  onRetry,
  compact = false,
}: {
  message: string;
  onRetry: () => void;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-4 rounded-xl border border-dashed border-[var(--border-strong)] px-6 text-center",
        compact ? "py-6" : "py-16",
      )}
    >
      <p className="max-w-[420px] text-sm text-destructive">{message}</p>
      <Button
        variant="outline"
        size={compact ? "sm" : "default"}
        onClick={onRetry}
      >
        Try Again
      </Button>
    </div>
  );
}
