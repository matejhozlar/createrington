import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Newspaper, AlertTriangle, Info, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { timeAgo } from "../../format";

const severityConfig = {
  info: {
    icon: Info,
    variant: "secondary" as const,
    className: "",
    iconColor: "text-blue-400",
    dotColor: "bg-blue-400",
  },
  warning: {
    icon: AlertTriangle,
    variant: "outline" as const,
    className: "text-yellow-500 border-yellow-500/30 bg-yellow-500/5",
    iconColor: "text-yellow-400",
    dotColor: "bg-yellow-400",
  },
  critical: {
    icon: AlertCircle,
    variant: "destructive" as const,
    className: "",
    iconColor: "text-red-400",
    dotColor: "bg-red-400",
  },
};

export function NewsFeed() {
  const { data, isLoading } = trpc.public.crypto.newsFeed.useQuery(
    { limit: 15 },
    { refetchInterval: 30_000 },
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Newspaper className="size-3.5" />
          Market News
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : !data?.length ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No recent market activity
          </p>
        ) : (
          <div className="max-h-[500px] overflow-y-auto space-y-2 pr-1">
            {data.map((event) => {
              const config =
                severityConfig[event.severity as keyof typeof severityConfig] ??
                severityConfig.info;
              const Icon = config.icon;

              return (
                <div
                  key={event.id}
                  className="flex gap-3 rounded-xl border bg-card/50 p-3"
                >
                  <div className="mt-0.5 shrink-0">
                    <Icon className={cn("size-4", config.iconColor)} />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <Badge
                        variant={config.variant}
                        className={cn("text-[10px]", config.className)}
                      >
                        {event.severity}
                      </Badge>
                      <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                        {timeAgo(event.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm font-medium leading-tight">
                      {event.title}
                    </p>
                    {event.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
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
