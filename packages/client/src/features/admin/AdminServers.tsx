import { useNavigate } from "react-router";
import { ErrorState, LoadingState } from "@/components/query-states";
import { StatCard } from "@/components/stat-card";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { PresenceBadge } from "@/components/presence-badge";
import { Progress } from "@/components/ui/progress";
import { Server, Users, Clock, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { useServerData } from "@/contexts/server-data";
import { useQuery } from "@tanstack/react-query";

export function AdminServers() {
  const navigate = useNavigate();
  const { getServer } = useServerData();

  const listQuery = useQuery(trpc.admin.servers.list.queryOptions());
  const servers = listQuery.data?.servers ?? [];
  const totals = listQuery.data?.totals;
  const loading = listQuery.isLoading;
  const error = listQuery.error?.message ?? null;

  return (
    <div className="flex flex-1 flex-col gap-4">
      {/* Header */}
      <AdminPageHeader
        trail={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Servers" },
        ]}
      />

      <div className="mx-auto w-full max-w-[1400px] flex flex-1 flex-col gap-4 px-4 pb-4">
        {loading ? (
          <LoadingState text="Loading servers..." className="flex-none py-8" />
        ) : error ? (
          <ErrorState
            message={error}
            onRetry={() => listQuery.refetch()}
            className="flex-none py-8"
          />
        ) : (
          <>
            {totals && (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  label="Total Servers"
                  value={totals.totalServers}
                  icon={Server}
                  tone="primary"
                  footer={`${totals.onlineServers} online`}
                />
                <StatCard
                  label="Players Online"
                  value={totals.totalPlayersOnline}
                  icon={Users}
                  tone="chart-2"
                  footer="Across all servers"
                />
                <StatCard
                  label="Total Playtime"
                  value={`${totals.totalHours.toLocaleString()}h`}
                  icon={Clock}
                  tone="chart-3"
                  footer="All time"
                />
                <StatCard
                  label="Avg Session"
                  value={`${
                    servers.length > 0
                      ? Math.round(
                          servers.reduce(
                            (sum, s) => sum + s.stats.avgSessionSeconds,
                            0,
                          ) /
                            servers.length /
                            60,
                        )
                      : 0
                  }m`}
                  icon={Activity}
                  tone="chart-4"
                  footer="Average duration"
                />
              </div>
            )}

            {/* Server Cards Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {servers.map((server) => {
                const liveData = getServer(server.serverId);
                const isOnline = liveData?.online ?? server.status === "online";
                const isMaintenance =
                  liveData?.maintenance ?? server.maintenance ?? false;
                const livePlayerCount =
                  liveData?.playerCount ?? server.playerCount;

                const presence = isMaintenance
                  ? "maintenance"
                  : isOnline
                    ? "online"
                    : "offline";

                return (
                  <Card
                    key={server.serverId}
                    className="cursor-pointer transition-colors hover:bg-accent/50"
                    onClick={() =>
                      navigate(`/admin/servers/${server.serverId}`)
                    }
                  >
                    <CardContent className="flex flex-col gap-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              "flex size-10 items-center justify-center rounded-lg",
                              isMaintenance
                                ? "bg-amber-500/10"
                                : isOnline
                                  ? "bg-green-500/10"
                                  : "bg-muted-foreground/10",
                            )}
                          >
                            <Server
                              className={cn(
                                "size-5",
                                isMaintenance
                                  ? "text-amber-500"
                                  : isOnline
                                    ? "text-green-500"
                                    : "text-muted-foreground",
                              )}
                            />
                          </div>
                          <div>
                            <p className="font-semibold">{server.serverName}</p>
                            <p className="text-xs text-muted-foreground">
                              {server.ip}:{server.port}
                            </p>
                          </div>
                        </div>
                        <PresenceBadge status={presence} />
                      </div>

                      {/* Player count bar */}
                      <div>
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Players</span>
                          <span className="font-medium">
                            {livePlayerCount} / {server.maxPlayers}
                          </span>
                        </div>
                        <Progress
                          className="bg-muted"
                          indicatorClassName={cn(
                            isMaintenance
                              ? "bg-amber-500"
                              : isOnline
                                ? "bg-green-500"
                                : "bg-muted-foreground",
                          )}
                          value={Math.min(
                            (livePlayerCount / server.maxPlayers) * 100,
                            100,
                          )}
                        />
                      </div>

                      {/* Stats row */}
                      <div className="grid grid-cols-3 gap-2 text-center text-sm">
                        <div>
                          <p className="text-muted-foreground">Unique</p>
                          <p className="font-medium">
                            {server.stats.uniquePlayers}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Hours</p>
                          <p className="font-medium">
                            {server.stats.totalHours.toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Avg Session</p>
                          <p className="font-medium">
                            {Math.round(server.stats.avgSessionSeconds / 60)}m
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
