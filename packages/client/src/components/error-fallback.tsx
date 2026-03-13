import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Home, ArrowLeft, RefreshCw, AlertOctagon } from "lucide-react";

export function ErrorFallback({
  error,
  onReset,
}: {
  error: Error | null;
  onReset: () => void;
}) {
  return (
    <div className="min-h-[calc(100vh-3.5rem)] md:min-h-screen flex items-center justify-center p-6 bg-background select-none">
      <Card className="w-full max-w-xl border-border bg-card/60 backdrop-blur supports-[backdrop-filter]:bg-card/50">
        <CardHeader className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex size-10 items-center justify-center rounded-lg bg-destructive/10">
              <AlertOctagon className="size-5 text-destructive" />
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-semibold text-foreground">
                  Something went wrong
                </h1>
                <Badge variant="outline" className="text-destructive">
                  Error
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                An unexpected error occurred while rendering this page.
              </p>
            </div>
          </div>

          {error?.message && (
            <div
              className={cn(
                "rounded-lg border border-border bg-sidebar-accent/40 px-3 py-2",
                "text-sm text-muted-foreground font-mono break-all",
              )}
            >
              {error.message}
            </div>
          )}
        </CardHeader>

        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            <button
              type="button"
              onClick={onReset}
              className={cn(
                "group flex items-center gap-3 rounded-lg border border-border bg-background/40 p-3 text-left",
                "transition-colors hover:bg-sidebar-accent/30 cursor-pointer",
              )}
            >
              <div className="flex size-9 items-center justify-center rounded-md bg-sidebar-accent">
                <RefreshCw className="size-4 text-muted-foreground transition-colors group-hover:text-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  Try again
                </p>
                <p className="text-xs text-muted-foreground">
                  Re-render the page
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => window.history.back()}
              className={cn(
                "group flex items-center gap-3 rounded-lg border border-border bg-background/40 p-3 text-left",
                "transition-colors hover:bg-sidebar-accent/30 cursor-pointer",
              )}
            >
              <div className="flex size-9 items-center justify-center rounded-md bg-sidebar-accent">
                <ArrowLeft className="size-4 text-muted-foreground transition-colors group-hover:text-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">Go back</p>
                <p className="text-xs text-muted-foreground">
                  Previous page
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => (window.location.href = "/")}
              className={cn(
                "group flex items-center gap-3 rounded-lg border border-border bg-background/40 p-3 text-left",
                "transition-colors hover:bg-sidebar-accent/30 cursor-pointer",
              )}
            >
              <div className="flex size-9 items-center justify-center rounded-md bg-sidebar-accent">
                <Home className="size-4 text-muted-foreground transition-colors group-hover:text-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">Home</p>
                <p className="text-xs text-muted-foreground">
                  Go to homepage
                </p>
              </div>
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
