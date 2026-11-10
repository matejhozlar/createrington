import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Loading } from "@/components/loading-spinner";
import { cn } from "@/lib/utils";

function StateFrame({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-1 items-center justify-center px-6 py-12",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function LoadingState({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  return (
    <StateFrame className={className}>
      <Loading size="medium" text={text} />
    </StateFrame>
  );
}

export function ErrorState({
  message,
  onRetry,
  className,
}: {
  message: string;
  onRetry: () => void;
  className?: string;
}) {
  return (
    <StateFrame className={className}>
      <div className="text-center">
        <p className="text-destructive">{message}</p>
        <Button onClick={onRetry} className="mt-4" variant="outline">
          Try Again
        </Button>
      </div>
    </StateFrame>
  );
}

export function EmptyState({
  icon: Icon,
  message,
  hint,
  className,
  children,
}: {
  icon: LucideIcon;
  message: React.ReactNode;
  hint?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <StateFrame className={className}>
      <div className="text-center">
        <Icon className="mx-auto size-12 text-muted-foreground" />
        <p className="mt-2 text-muted-foreground">{message}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        {children && <div className="mt-4">{children}</div>}
      </div>
    </StateFrame>
  );
}
