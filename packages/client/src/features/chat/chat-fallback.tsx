import { LoadingState } from "@/components/query-states";

export function ChatFallback({
  loading,
  message,
}: {
  loading?: boolean;
  message?: string;
}) {
  return (
    <div className="flex h-full items-center justify-center">
      {loading ? (
        <LoadingState text="Loading chat..." className="p-0" />
      ) : (
        <p className="text-muted-foreground">{message}</p>
      )}
    </div>
  );
}
