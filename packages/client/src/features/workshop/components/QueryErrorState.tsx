import { Button } from "@/components/ui/button";

export function QueryErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-[var(--border-strong)] px-6 py-16 text-center">
      <p className="max-w-[420px] text-sm text-destructive">{message}</p>
      <Button variant="outline" onClick={onRetry}>
        Try Again
      </Button>
    </div>
  );
}
