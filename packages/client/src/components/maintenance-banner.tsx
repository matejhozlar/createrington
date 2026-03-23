import { Wrench } from "lucide-react";
import { useServerData } from "@/contexts/server-data";
import { useCountdown } from "@/hooks/use-countdown";

function BannerContent({ scheduledAt }: { scheduledAt: string }) {
  const countdown = useCountdown(scheduledAt);

  if (!countdown || countdown === "Ended") return null;

  return (
    <div className="mx-4 mt-4 flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
      <Wrench className="size-4 shrink-0 text-amber-500" />
      <div className="min-w-0 flex-1">
        <span className="text-sm font-medium text-amber-500">
          Scheduled Maintenance
        </span>
        <span className="ml-2 text-xs text-muted-foreground">
          Server will go offline for maintenance
        </span>
      </div>
      <span className="shrink-0 font-mono text-sm tabular-nums text-amber-500">
        {countdown}
      </span>
    </div>
  );
}

export function MaintenanceBanner() {
  const { servers } = useServerData();

  const scheduled = servers.find(
    (s) => s.scheduledMaintenance?.status === "scheduled",
  );

  if (!scheduled?.scheduledMaintenance) return null;

  return (
    <BannerContent scheduledAt={scheduled.scheduledMaintenance.scheduledAt} />
  );
}
