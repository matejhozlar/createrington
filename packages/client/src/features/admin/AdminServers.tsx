import { useNavigate } from "react-router-dom";
import { Loading } from "@/components/loading-spinner";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Server, Users, Clock, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { useServerData } from "@/contexts/server-data";

export function AdminServers() {
  const navigate = useNavigate();
  const { getServer } = useServerData();

  const listQuery = trpc.admin.servers.list.useQuery();
  const servers = listQuery.data?.servers ?? [];
  const totals = listQuery.data?.totals;
  const loading = listQuery.isLoading;
  const error = listQuery.error?.message ?? null;

  return (
    <div className="flex flex-1 flex-col gap-4">
      {/* Header */}
      <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border bg-sidebar px-4">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/admin/dashboard">Admin</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Servers</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      <div className="flex flex-1 flex-col gap-4 px-4 pb-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loading size="medium" text="Loading servers..." />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <p className="text-destructive">{error}</p>
              <Button
                onClick={() => listQuery.refetch()}
                className="mt-4"
                variant="outline"
              >
                Try Again
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Stats Cards */}
            {totals && (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardContent className="flex items-start justify-between">
                    <div>
                      <CardDescription>Total Servers</CardDescription>
                      <CardTitle className="text-2xl">
                        {totals.totalServers}
                      </CardTitle>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {totals.onlineServers} online
                      </p>
                    </div>
                    <div className="flex size-12 items-center justify-center rounded-full bg-sidebar-primary/10">
                      <Server className="size-6 text-sidebar-primary" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="flex items-start justify-between">
                    <div>
                      <CardDescription>Players Online</CardDescription>
                      <CardTitle className="text-2xl">
                        {totals.totalPlayersOnline}
                      </CardTitle>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Across all servers
                      </p>
                    </div>
                    <div className="flex size-12 items-center justify-center rounded-full bg-chart-2/10">
                      <Users className="size-6 text-chart-2" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="flex items-start justify-between">
                    <div>
                      <CardDescription>Total Playtime</CardDescription>
                      <CardTitle className="text-2xl">
                        {totals.totalHours.toLocaleString()}h
                      </CardTitle>
                      <p className="mt-2 text-xs text-muted-foreground">
                        All time
                      </p>
                    </div>
                    <div className="flex size-12 items-center justify-center rounded-full bg-chart-3/10">
                      <Clock className="size-6 text-chart-3" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="flex items-start justify-between">
                    <div>
                      <CardDescription>Avg Session</CardDescription>
                      <CardTitle className="text-2xl">
                        {servers.length > 0
                          ? Math.round(
                              servers.reduce(
                                (sum, s) => sum + s.stats.avgSessionSeconds,
                                0,
                              ) /
                                servers.length /
                                60,
                            )
                          : 0}
                        m
                      </CardTitle>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Average duration
                      </p>
                    </div>
                    <div className="flex size-12 items-center justify-center rounded-full bg-chart-4/10">
                      <Activity className="size-6 text-chart-4" />
                    </div>
                  </CardContent>
                </Card>
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

                const statusLabel = isMaintenance
                  ? "Maintenance"
                  : isOnline
                    ? "Online"
                    : "Offline";

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
                        <Badge
                          variant={
                            isOnline || isMaintenance ? "default" : "outline"
                          }
                          className={cn(
                            isMaintenance &&
                              "bg-amber-500/20 text-amber-500 hover:bg-amber-500/30",
                            !isMaintenance &&
                              isOnline &&
                              "bg-green-500/20 text-green-500 hover:bg-green-500/30",
                          )}
                        >
                          {statusLabel}
                        </Badge>
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
