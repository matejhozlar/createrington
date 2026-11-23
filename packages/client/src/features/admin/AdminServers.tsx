import { useNavigate } from "react-router";
import { ErrorState, LoadingState } from "@/components/query-states";
import { StatCard } from "@/components/stat-card";
import { AdminPage } from "@/features/admin/components/AdminPage";
import { AdminPageTitle } from "@/features/admin/components/AdminPageTitle";
import { Card, CardContent } from "@/components/ui/card";
import { PresenceBadge } from "@/components/presence-badge";
import { Progress } from "@/components/ui/progress";
import { Server, Users, Clock, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc, type RouterOutput } from "@/lib/trpc";
import { useLiveServerState } from "@/contexts/server-data";
import { PRESENCE_STYLES } from "@/components/presence";
import { useQuery } from "@tanstack/react-query";

type ServerRow = RouterOutput["admin"]["servers"]["list"]["servers"][number];

export function AdminServers() {
  const navigate = useNavigate();

  const listQuery = useQuery(trpc.admin.servers.list.queryOptions());
  const servers = listQuery.data?.servers ?? [];
  const totals = listQuery.data?.totals;
  const loading = listQuery.isLoading;
  const error = listQuery.error?.message ?? null;

  return (
    <AdminPage
      trail={[
        { label: "Admin", href: "/admin/dashboard" },
        { label: "Servers" },
      ]}
    >
      <AdminPageTitle title="Servers" />
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

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {servers.map((server) => (
              <ServerCard
                key={server.serverId}
                server={server}
                onOpen={() => navigate(`/admin/servers/${server.serverId}`)}
              />
            ))}
          </div>
        </>
      )}
    </AdminPage>
  );
}

function ServerCard({
  server,
  onOpen,
}: {
  server: ServerRow;
  onOpen: () => void;
}) {
  const { presence, playerCount } = useLiveServerState(server);
  const styles = PRESENCE_STYLES[presence];

  return (
    <Card
      className="cursor-pointer transition-colors hover:bg-accent/50"
      onClick={onOpen}
    >
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex size-10 items-center justify-center rounded-lg",
                styles.tile,
              )}
            >
              <Server className="size-5" />
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

        <div>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Players</span>
            <span className="font-medium">
              {playerCount} / {server.maxPlayers}
            </span>
          </div>
          <Progress
            className="bg-muted"
            indicatorClassName={styles.fill}
            value={Math.min((playerCount / server.maxPlayers) * 100, 100)}
          />
        </div>

        <div className="grid grid-cols-3 gap-2 text-center text-sm">
          <div>
            <p className="text-muted-foreground">Unique</p>
            <p className="font-medium">{server.stats.uniquePlayers}</p>
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
}
