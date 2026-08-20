import { Badge } from "@/components/ui/badge";
import type { RouterOutput } from "@/lib/trpc";

type PlayerDetailed = RouterOutput["admin"]["players"]["players"]["get"];

interface OverviewTabProps {
  player: PlayerDetailed;
  getServerName: (serverId: number) => string | null;
}

export function OverviewTab({ player, getServerName }: OverviewTabProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Playtime by Server</h3>
        <div className="mt-4 space-y-2">
          {player.playtime.summary.map((server) => {
            const serverName = getServerName(server.serverId);
            return (
              <div
                key={server.serverId}
                className="flex items-center justify-between rounded-lg border border-border p-4"
              >
                <div>
                  <p className="font-medium">{serverName}</p>
                  <p className="text-xs text-muted-foreground">
                    {server.totalSessions} sessions
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">
                    {Math.floor(parseInt(server.totalSeconds) / 3600)}h{" "}
                    {Math.floor((parseInt(server.totalSeconds) % 3600) / 60)}m
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Avg: {Math.floor(parseInt(server.avgSessionSeconds) / 60)}m
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {player.waitlist && (
        <div>
          <h3 className="text-lg font-semibold">Waitlist Status</h3>
          <div className="mt-4 rounded-lg border border-border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Status: {player.waitlist.status}</p>
                <p className="text-xs text-muted-foreground">
                  Queued:{" "}
                  {new Date(player.waitlist.queuedAt).toLocaleDateString()}
                </p>
              </div>
              {player.waitlist.registeredAt && (
                <Badge variant="default">Registered</Badge>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
