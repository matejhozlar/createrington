import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/auth";
import { trpc } from "@/lib/trpc";
import { Loading } from "@/components/loading-spinner";
import { MinecraftAvatar } from "@/components/minecraft-avatar";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Users,
  Server,
  UserPlus,
  TrendingUp,
  ArrowRight,
  Shield,
  Activity,
  Terminal,
} from "lucide-react";

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const profileQuery = trpc.admin.dashboard.profile.useQuery();
  const playerStatsQuery = trpc.admin.players.players.stats.useQuery();
  const serversQuery = trpc.admin.servers.list.useQuery();
  const waitlistStatsQuery = trpc.admin.waitlists.stats.useQuery();
  const recentBansQuery = trpc.admin.players.bans.getRecent.useQuery({
    limit: 5,
    activeOnly: false,
  });
  const recentLogsQuery = trpc.admin.logs.list.useQuery({
    page: 0,
    limit: 8,
    orderBy: "performedAt",
    orderDirection: "desc",
  });
  const commandStatsQuery = trpc.admin.dashboard.commandStats.useQuery();

  const isLoading =
    profileQuery.isLoading ||
    playerStatsQuery.isLoading ||
    serversQuery.isLoading ||
    waitlistStatsQuery.isLoading;

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-4">
        <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border bg-sidebar px-4">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>Admin Dashboard</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <div className="flex flex-1 items-center justify-center">
          <Loading size="medium" text="Loading dashboard..." />
        </div>
      </div>
    );
  }

  const profile = profileQuery.data;
  const playerStats = playerStatsQuery.data;
  const serversData = serversQuery.data;
  const waitlistStats = waitlistStatsQuery.data;
  const recentBans = recentBansQuery.data?.bans ?? [];
  const recentLogs = recentLogsQuery.data?.actions ?? [];

  return (
    <div className="flex flex-1 flex-col gap-4">
      {/* Header */}
      <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border bg-sidebar px-4">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage>Admin Dashboard</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      <div className="mx-auto w-full max-w-[1400px] flex flex-1 flex-col gap-4 px-4 pb-4">
        {/* Admin Profile Card */}
        {user && (
          <Card>
            <CardContent className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <MinecraftAvatar
                  username={user.minecraftUsername}
                  uuid={user.minecraftUuid}
                  size={64}
                />
                <div>
                  <h2 className="text-xl font-semibold">
                    {user.minecraftUsername}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {user.username}
                  </p>
                  {profile?.adminSince && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Admin since{" "}
                      {formatDate(
                        typeof profile.adminSince === "string"
                          ? profile.adminSince
                          : new Date(profile.adminSince).toISOString(),
                      )}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <p className="text-2xl font-bold">
                    {profile?.totalActions ?? 0}
                  </p>
                  <p className="text-xs text-muted-foreground">Total Actions</p>
                </div>
                <Separator orientation="vertical" className="h-12" />
                <div className="text-center">
                  <p className="text-2xl font-bold">
                    {profile?.recentActions ?? 0}
                  </p>
                  <p className="text-xs text-muted-foreground">Last 7 Days</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Total Players */}
          <Card>
            <CardContent className="flex items-start justify-between">
              <div>
                <CardDescription>Total Players</CardDescription>
                <CardTitle className="text-2xl">
                  {playerStats?.total ?? 0}
                </CardTitle>
                <p className="mt-2 text-xs text-muted-foreground">
                  {playerStats?.online ?? 0} online
                </p>
              </div>
              <div className="flex size-12 items-center justify-center rounded-full bg-sidebar-primary/10">
                <Users className="size-6 text-sidebar-primary" />
              </div>
            </CardContent>
          </Card>

          {/* Servers */}
          <Card>
            <CardContent className="flex items-start justify-between">
              <div>
                <CardDescription>Servers</CardDescription>
                <CardTitle className="text-2xl">
                  {serversData?.totals.onlineServers ?? 0}/
                  {serversData?.totals.totalServers ?? 0}
                </CardTitle>
                <p className="mt-2 text-xs text-muted-foreground">
                  {serversData?.totals.totalPlayersOnline ?? 0} players online
                </p>
              </div>
              <div className="flex size-12 items-center justify-center rounded-full bg-chart-2/10">
                <Server className="size-6 text-chart-2" />
              </div>
            </CardContent>
          </Card>

          {/* Waitlist */}
          <Card>
            <CardContent className="flex items-start justify-between">
              <div>
                <CardDescription>Waitlist Pending</CardDescription>
                <CardTitle className="text-2xl">
                  {waitlistStats?.pending ?? 0}
                </CardTitle>
                <p className="mt-2 text-xs text-muted-foreground">
                  {waitlistStats?.submitted.thisWeek ?? 0} new this week
                </p>
              </div>
              <div className="flex size-12 items-center justify-center rounded-full bg-chart-3/10">
                <UserPlus className="size-6 text-chart-3" />
              </div>
            </CardContent>
          </Card>

          {/* New This Week */}
          <Card>
            <CardContent className="flex items-start justify-between">
              <div>
                <CardDescription>New This Week</CardDescription>
                <CardTitle className="text-2xl">
                  {playerStats?.registered.thisWeek ?? 0}
                </CardTitle>
                <p className="mt-2 text-xs text-muted-foreground">
                  {playerStats?.registered.today ?? 0} today
                </p>
              </div>
              <div className="flex size-12 items-center justify-center rounded-full bg-chart-4/10">
                <TrendingUp className="size-6 text-chart-4" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Three-column: Recent Bans + Recent Activity + Top Commands */}
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Recent Bans */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="size-4 text-muted-foreground" />
                Recent Bans
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/admin/players")}
              >
                View All
                <ArrowRight className="ml-1 size-3.5" />
              </Button>
            </CardHeader>
            <CardContent>
              {recentBansQuery.isLoading ? (
                <Loading size="small" text="Loading bans..." />
              ) : recentBans.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No recent bans
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Player</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>By</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentBans.map((ban) => (
                      <TableRow key={ban.id}>
                        <TableCell className="font-medium">
                          {ban.metadata?.minecraftUsername ??
                            ban.playerMinecraftUuid.slice(0, 8)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              ban.banType === "permanent"
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            {ban.banType}
                          </Badge>
                        </TableCell>
                        <TableCell
                          className="max-w-[150px] truncate"
                          title={ban.reason}
                        >
                          {ban.reason}
                        </TableCell>
                        <TableCell>{ban.bannedByUsername}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatRelativeDate(
                            typeof ban.bannedAt === "string"
                              ? ban.bannedAt
                              : new Date(ban.bannedAt).toISOString(),
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="size-4 text-muted-foreground" />
                Recent Activity
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/admin/logs")}
              >
                View All
                <ArrowRight className="ml-1 size-3.5" />
              </Button>
            </CardHeader>
            <CardContent>
              {recentLogsQuery.isLoading ? (
                <Loading size="small" text="Loading activity..." />
              ) : recentLogs.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No recent activity
                </p>
              ) : (
                <div className="space-y-0">
                  {recentLogs.map((action, i) => (
                    <div key={action.id}>
                      <div className="flex items-center justify-between py-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm font-medium shrink-0">
                            {action.adminUsername}
                          </span>
                          <Badge variant="outline" className="shrink-0">
                            {action.actionType}
                          </Badge>
                          <span className="text-sm text-muted-foreground truncate">
                            {action.targetPlayerName}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0 ml-2">
                          {formatRelativeDate(
                            typeof action.performedAt === "string"
                              ? action.performedAt
                              : new Date(action.performedAt).toISOString(),
                          )}
                        </span>
                      </div>
                      {i < recentLogs.length - 1 && <Separator />}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Commands */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Terminal className="size-4 text-muted-foreground" />
                Top Commands
              </CardTitle>
              <CardDescription>
                {commandStatsQuery.data?.totalToday ?? 0} executions today
              </CardDescription>
            </CardHeader>
            <CardContent>
              {commandStatsQuery.isLoading ? (
                <Loading size="small" text="Loading stats..." />
              ) : !commandStatsQuery.data?.topCommands.length ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No command usage yet
                </p>
              ) : (
                <div className="space-y-3">
                  {commandStatsQuery.data.topCommands.map((cmd) => {
                    const maxCount =
                      commandStatsQuery.data!.topCommands[0]!.count;
                    const pct = maxCount > 0 ? (cmd.count / maxCount) * 100 : 0;
                    return (
                      <div key={cmd.commandName} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">
                            /{cmd.commandName}
                          </span>
                          <span className="text-muted-foreground">
                            {cmd.count}
                          </span>
                        </div>
                        <Progress
                          className="bg-muted"
                          indicatorClassName="bg-sidebar-primary"
                          value={pct}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Two-column: Server Overview + Waitlist Summary */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Server Overview */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Server className="size-4 text-muted-foreground" />
                Server Overview
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/admin/servers")}
              >
                View All
                <ArrowRight className="ml-1 size-3.5" />
              </Button>
            </CardHeader>
            <CardContent>
              {serversData?.servers.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No servers configured
                </p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {serversData?.servers.map((server) => (
                    <button
                      key={server.serverId}
                      type="button"
                      onClick={() =>
                        navigate(`/admin/servers/${server.serverId}`)
                      }
                      className="flex items-center justify-between rounded-lg border p-3 text-left transition-colors hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`size-2 rounded-full ${
                            server.status === "online"
                              ? "bg-green-500"
                              : "bg-muted-foreground"
                          }`}
                        />
                        <span className="text-sm font-medium">
                          {server.serverName}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {server.playerCount}/{server.maxPlayers}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Waitlist Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <UserPlus className="size-4 text-muted-foreground" />
                Waitlist Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-2xl font-bold">
                    {waitlistStats?.pending ?? 0}
                  </p>
                  <p className="text-xs text-muted-foreground">Pending</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-2xl font-bold">
                    {(waitlistStats?.accepted ?? 0) +
                      (waitlistStats?.autoAccepted ?? 0)}
                  </p>
                  <p className="text-xs text-muted-foreground">Accepted</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-2xl font-bold">
                    {waitlistStats?.verified ?? 0}
                  </p>
                  <p className="text-xs text-muted-foreground">Verified</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-2xl font-bold">
                    {waitlistStats?.registered ?? 0}
                  </p>
                  <p className="text-xs text-muted-foreground">Registered</p>
                </div>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => navigate("/admin/waitlist")}
              >
                Manage Waitlist
                <ArrowRight className="ml-1 size-3.5" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
