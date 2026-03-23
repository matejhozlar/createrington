import { useState } from "react";
import { Wrench, X, ChevronUp } from "lucide-react";
import { useServerData } from "@/contexts/server-data";
import { useCountdown } from "@/hooks/use-countdown";

/** Floating maintenance countdown popup, dismissible by the user. */
export function MaintenanceBanner() {
  const { servers } = useServerData();
  const [dismissed, setDismissed] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const scheduled = servers.find(
    (s) => s.scheduledMaintenance?.status === "scheduled",
  );

  if (!scheduled?.scheduledMaintenance || dismissed) return null;

  return (
    <BannerContent
      scheduledAt={scheduled.scheduledMaintenance.scheduledAt}
      estimatedMinutes={scheduled.scheduledMaintenance.estimatedMinutes}
      collapsed={collapsed}
      onCollapse={() => setCollapsed((c) => !c)}
      onDismiss={() => setDismissed(true)}
    />
  );
}

function BannerContent({
  scheduledAt,
  estimatedMinutes,
  collapsed,
  onCollapse,
  onDismiss,
}: {
  scheduledAt: string;
  estimatedMinutes: number;
  collapsed: boolean;
  onCollapse: () => void;
  onDismiss: () => void;
}) {
  const countdown = useCountdown(scheduledAt);

  if (!countdown || countdown === "Ended") return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 rounded-lg border border-amber-500/30 bg-background shadow-lg">
      <div className="flex items-center gap-2 px-3 py-2">
        <Wrench className="size-4 shrink-0 text-amber-500" />
        <span className="flex-1 text-sm font-medium text-amber-500">
          Scheduled Maintenance
        </span>
        <span className="shrink-0 font-mono text-sm tabular-nums text-amber-500">
          {countdown}
        </span>
        <button
          onClick={onCollapse}
          className="ml-1 rounded p-0.5 text-muted-foreground hover:text-foreground"
        >
          <ChevronUp
            className={`size-3.5 transition-transform ${collapsed ? "rotate-180" : ""}`}
          />
        </button>
        <button
          onClick={onDismiss}
          className="rounded p-0.5 text-muted-foreground hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      </div>
      {!collapsed && (
        <div className="border-t border-amber-500/20 px-3 py-2">
          <p className="text-xs text-muted-foreground">
            Server goes offline{" "}
            {new Date(scheduledAt).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}{" "}
            for ~{estimatedMinutes} min
          </p>
        </div>
      )}
    </div>
  );
}
