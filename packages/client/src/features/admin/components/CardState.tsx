import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { Loading } from "@/components/loading-spinner";

export function CardLoading({ text }: { text: string }) {
  return (
    <CardContent className="flex flex-1 items-center justify-center py-12">
      <Loading size="medium" text={text} />
    </CardContent>
  );
}

export function CardError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <CardContent className="flex flex-1 items-center justify-center py-12">
      <div className="text-center">
        <p className="text-destructive">{message}</p>
        <Button onClick={onRetry} className="mt-4" variant="outline">
          Try Again
        </Button>
      </div>
    </CardContent>
  );
}

export function CardEmpty({
  icon: Icon,
  message,
  children,
}: {
  icon: LucideIcon;
  message: string;
  children?: React.ReactNode;
}) {
  return (
    <CardContent className="flex flex-1 items-center justify-center py-12">
      <div className="text-center">
        <Icon className="mx-auto size-12 text-muted-foreground" />
        <p className="mt-2 text-muted-foreground">{message}</p>
        {children && <div className="mt-4">{children}</div>}
      </div>
    </CardContent>
  );
}
