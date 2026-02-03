import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Home, ArrowLeft, Search, Compass, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export function NotFound() {
  const navigate = useNavigate();
  const location = useLocation();

  const path = useMemo(() => location.pathname, [location.pathname]);

  return (
    <div className="min-h-[calc(100vh-3.5rem)] md:min-h-screen flex items-center justify-center p-6 bg-background select-none">
      <Card className="w-full max-w-xl border-border bg-card/60 backdrop-blur supports-[backdrop-filter]:bg-card/50">
        <CardHeader className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex size-10 items-center justify-center rounded-lg bg-sidebar-accent">
              <AlertTriangle className="size-5 text-muted-foreground" />
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-semibold text-foreground">
                  Page not found
                </h1>
                <Badge variant="outline" className="text-muted-foreground">
                  404
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                The page you’re looking for doesn’t exist (or moved).
              </p>
            </div>
          </div>

          <div
            className={cn(
              "rounded-lg border border-border bg-sidebar-accent/40 px-3 py-2",
              "text-sm text-muted-foreground font-mono",
            )}
          >
            {path}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => navigate(-1)}
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
                  Return to the previous page
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => navigate("/")}
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
                  Go to the homepage
                </p>
              </div>
            </button>
          </div>

          <div className="rounded-lg border border-border bg-background/40 p-4">
            <div className="flex items-center gap-2">
              <Compass className="size-4 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">
                Quick suggestions
              </p>
            </div>

            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <span className="inline-flex size-6 items-center justify-center rounded-md bg-sidebar-accent">
                  <Search className="size-3.5" />
                </span>
                Check the URL for typos.
              </li>
              <li className="flex items-center gap-2">
                <span className="inline-flex size-6 items-center justify-center rounded-md bg-sidebar-accent">
                  <Search className="size-3.5" />
                </span>
                If this should exist, it may be behind permissions.
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
