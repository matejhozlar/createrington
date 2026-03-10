import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Newspaper, AlertTriangle, Info, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { timeAgo } from "./format";

/** Maps each severity level to its icon, badge variant, and optional className overrides. */
const severityConfig = {
  info: {
    icon: Info,
    variant: "secondary" as const,
    className: "",
  },
  warning: {
    icon: AlertTriangle,
    variant: "outline" as const,
    className: "text-yellow-500 border-yellow-500/50",
  },
  critical: {
    icon: AlertCircle,
    variant: "destructive" as const,
    className: "",
  },
};

/** Displays a live-updating feed of market news events, colour-coded by severity. */
export function NewsFeed() {
  const { data, isLoading } = trpc.public.crypto.newsFeed.useQuery(
    { limit: 15 },
    { refetchInterval: 30_000 },
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Newspaper className="h-4 w-4" />
          Market News
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded bg-muted" />
            ))}
          </div>
        ) : !data?.length ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No recent market activity
          </p>
        ) : (
          <div className="max-h-[500px] overflow-y-auto space-y-3 pr-1">
            {data.map((event) => {
              // Fall back to "info" style for any unrecognised severity values
              const config = severityConfig[event.severity as keyof typeof severityConfig] ?? severityConfig.info;
              const Icon = config.icon;

              return (
                <div
                  key={event.id}
                  className="flex gap-3 rounded-lg border p-3"
                >
                  <div className="mt-0.5 shrink-0">
                    <Icon
                      className={cn("h-4 w-4", {
                        "text-blue-500": event.severity === "info",
                        "text-yellow-500": event.severity === "warning",
                        "text-destructive": event.severity === "critical",
                      })}
                    />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <Badge
                        variant={config.variant}
                        className={cn("text-[10px]", config.className)}
                      >
                        {event.severity}
                      </Badge>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {timeAgo(event.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm font-medium leading-tight">
                      {event.title}
                    </p>
                    {event.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {event.description}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
