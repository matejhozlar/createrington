import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const RING_SIZES = {
  small: "size-6 border-2",
  medium: "size-10 border-3",
  large: "size-16 border-4",
};

type RingSize = keyof typeof RING_SIZES;

function LoadingRing({
  size,
  text,
  subtext,
  progress,
  className,
}: {
  size: RingSize;
  text: string;
  subtext?: string;
  progress?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn("flex flex-col items-center gap-4", className)}
      role="status"
      aria-live="polite"
      aria-label={text}
    >
      <div
        className={cn(
          "animate-spin rounded-full border-primary border-t-transparent",
          RING_SIZES[size],
        )}
      />
      <div className="text-center">
        <div className="font-medium text-foreground">{text}</div>
        {subtext && (
          <div className="mt-1 text-sm text-muted-foreground">{subtext}</div>
        )}
      </div>
      {progress && (
        <div className="h-1 w-48 overflow-hidden rounded-full bg-muted">
          <div className="h-full animate-pulse bg-primary" />
        </div>
      )}
    </div>
  );
}

export function LoadingScreen({
  text = "Loading...",
  subtext,
  progress = true,
}: {
  text?: string;
  subtext?: string;
  progress?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      <LoadingRing
        size="large"
        text={text}
        subtext={subtext}
        progress={progress}
        className="p-8"
      />
    </div>
  );
}

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
  text = "Loading...",
  size = "medium",
  className,
}: {
  text?: string;
  size?: RingSize;
  className?: string;
}) {
  return (
    <StateFrame className={className}>
      <LoadingRing size={size} text={text} />
    </StateFrame>
  );
}

export function ErrorState({
  message,
  onRetry,
  bordered = false,
  compact = false,
  className,
}: {
  message: string;
  onRetry: () => void;
  bordered?: boolean;
  compact?: boolean;
  className?: string;
}) {
  return (
    <StateFrame
      className={cn(
        bordered &&
          "flex-none rounded-xl border border-dashed border-[var(--border-strong)]",
        compact ? "py-6" : bordered && "py-16",
        className,
      )}
    >
      <div className="flex flex-col items-center gap-4 text-center">
        <p
          className={cn(
            "text-destructive",
            (bordered || compact) && "max-w-[420px] text-sm",
          )}
        >
          {message}
        </p>
        <Button
          onClick={onRetry}
          variant="outline"
          size={compact ? "sm" : "default"}
        >
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
