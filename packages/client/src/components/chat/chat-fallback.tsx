import { Loading } from "../loading-spinner";

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
        <Loading size="medium" text="Loading chat..." />
      ) : (
        <p className="text-muted-foreground">{message}</p>
      )}
    </div>
  );
}
